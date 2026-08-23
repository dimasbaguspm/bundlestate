/**
 * Anti-Pattern Inspector (PRD §4.3): a unified engine that evaluates the
 * normalized report against the six RULE-* detectors and returns a flat list
 * of findings the UI can render as a prioritized, severity-sorted table.
 *
 * Detection strategy:
 *  - RULE-01 (cycles) and RULE-02 (dup package drift) reuse the existing graph
 *    analysis already produced in insights (findCircularGroups / versionClashes).
 *  - RULE-03 (tree-shaking leak) and RULE-06 (unused exports) are AST-derived.
 *    We currently use high-recall regex/reference heuristics so the inspector
 *    stays dependency-free and fast; @babel/parser (PRD §4.1) is the precision
 *    upgrade path and can replace the heuristics without changing this contract.
 *  - RULE-04 (legacy polyfills) and RULE-05 (inlined asset excess) are content
 *    scans over package names and raw asset source.
 */

export type RuleId = "RULE-01" | "RULE-02" | "RULE-03" | "RULE-04" | "RULE-05" | "RULE-06";

export type Severity = "critical" | "high" | "medium" | "low";

export interface RuleFinding {
  rule: RuleId;
  title: string;
  severity: Severity;
  /** Human-readable explanation of why this was flagged. */
  detail: string;
  /** Where it was found (asset name, package, or cycle members). */
  location: string;
  /** Optional raw evidence (e.g. matched line) for the UI to show. */
  evidence?: string;
}

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const POLYFILL_PATTERNS: { match: RegExp; label: string }[] = [
  { match: /(^|\/)core-js(\/|$)/, label: "core-js" },
  { match: /(^|\/)regenerator-runtime(\/|$)/, label: "regenerator-runtime" },
  { match: /(^|\/)@babel\/polyfill(\/|$)/, label: "@babel/polyfill" },
  { match: /(^|\/)tslib(\/|$)/, label: "tslib" },
];

const INLINE_ASSET_THRESHOLD = 10 * 1024; // 10 KB (PRD §4.3 RULE-05)

const REQUIRE_RE = /(^|[^.\w$])require\s*\(\s*["'`]/;
const ESM_CONTEXT_RE = /\b(import\s|export\s|import\.meta)/;

/** Decode a base64 asset source to UTF-8; returns "" on failure. */
function decode(rawBytes: string): string {
  try {
    if (typeof atob === "function") {
      const bin = atob(rawBytes);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(out);
    }
    return Buffer.from(rawBytes, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/** RULE-03 + RULE-06 over a single JS asset's source. */
function scanAssetSource(assetName: string, source: string): RuleFinding[] {
  const out: RuleFinding[] = [];
  if (!source) return out;

  // RULE-03: CommonJS require() inside what looks like an ESM context.
  const looksEsm = ESM_CONTEXT_RE.test(source);
  if (looksEsm && REQUIRE_RE.test(source)) {
    const m = source.match(REQUIRE_RE);
    out.push({
      rule: "RULE-03",
      title: "Tree-shaking leak (CJS require in ESM)",
      severity: "high",
      detail:
        "A CommonJS `require()` call was found in ESM-oriented code, which prevents dead-code elimination and can pull an entire module into the bundle.",
      location: assetName,
      evidence: m ? m[0].trim() : undefined,
    });
  }

  // RULE-06: declared `export` names with no local re-reference in the asset.
  const exported = new Set<string>();
  const exportNameRe = /\bexport\s+(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g;
  let em: RegExpExecArray | null;
  while ((em = exportNameRe.exec(source)) !== null) exported.add(em[1]);
  if (exported.size > 0) {
    const unused: string[] = [];
    for (const name of exported) {
      // referenced somewhere other than the export declaration itself?
      const refRe = new RegExp(`\\b${name}\\b`, "g");
      const refs = (source.match(refRe) ?? []).length;
      if (refs <= 1) unused.push(name);
    }
    if (unused.length > 0) {
      out.push({
        rule: "RULE-06",
        title: "Unused export sprawl",
        severity: "low",
        detail: `Declared exports with no in-file references: ${unused.join(", ")}. These may be candidates for tree-shaking or removal.`,
        location: assetName,
        evidence: unused.slice(0, 5).join(", "),
      });
    }
  }

  // RULE-05: inlined Base64 / SVG data URIs above threshold.
  const dataUriRe =
    /data:(?:image\/[a-z+]+|application\/octet-stream|text\/plain);base64,([A-Za-z0-9+/=]+)/g;
  let dm: RegExpExecArray | null;
  while ((dm = dataUriRe.exec(source)) !== null) {
    const bytes = Math.ceil((dm[1].length * 3) / 4);
    if (bytes >= INLINE_ASSET_THRESHOLD) {
      out.push({
        rule: "RULE-05",
        title: "Inlined asset excess",
        severity: "medium",
        detail: `An inline data URI (~${Math.round(bytes / 1024)} KB) exceeds the 10 KB threshold, inflating bundle size and hurting cacheability.`,
        location: assetName,
        evidence: dm[0].slice(0, 48) + "…",
      });
      break; // one finding per asset is enough
    }
  }

  return out;
}

/**
 * Evaluate all six rules against a report. `sourceByAsset` is the decoded raw
 * source map (asset name → source); callers decode `asset.rawBytes` once.
 */
export function runInspector(input: {
  assets: { name: string; rawBytes: string; kind: string }[];
  packages: { fullName: string }[];
  versionClashes: { fullName: string; versions: { version: string }[] }[];
  circularDepGroups: string[][];
}): RuleFinding[] {
  const findings: RuleFinding[] = [];

  // RULE-01: circular dependency cycles.
  for (const group of input.circularDepGroups) {
    findings.push({
      rule: "RULE-01",
      title: "Circular dependency cycle",
      severity: "critical",
      detail: `Module cycle detected (${group.length} members): ${group.join(" → ")}. Circular imports can cause uninitialized exports and break scope hoisting.`,
      location: group.slice(0, 3).join(" → ") + (group.length > 3 ? " …" : ""),
    });
  }

  // RULE-02: duplicate package drift.
  for (const clash of input.versionClashes) {
    findings.push({
      rule: "RULE-02",
      title: "Duplicate package drift",
      severity: "high",
      detail: `${clash.fullName} ships ${clash.versions.length} versions (${clash.versions.map((v) => v.version).join(", ")}). Multiple copies bloat the bundle and can cause subtle state bugs.`,
      location: clash.fullName,
    });
  }

  // RULE-04: legacy polyfill bloat.
  const polyNames = new Set<string>();
  for (const pkg of input.packages) {
    for (const { match, label } of POLYFILL_PATTERNS) {
      if (match.test(pkg.fullName)) polyNames.add(label);
    }
  }
  if (polyNames.size > 0) {
    findings.push({
      rule: "RULE-04",
      title: "Legacy polyfill bloat",
      severity: "medium",
      detail: `Polyfills present (${[...polyNames].join(", ")}) targeting modern ES environments — likely redundant for evergreen browsers.`,
      location: [...polyNames].join(", "),
    });
  }

  // RULE-03 / RULE-... content scans per JS asset.
  for (const asset of input.assets) {
    if (asset.kind !== "js" || !asset.rawBytes) continue;
    findings.push(...scanAssetSource(asset.name, decode(asset.rawBytes)));
  }

  findings.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.rule.localeCompare(b.rule),
  );
  return findings;
}
