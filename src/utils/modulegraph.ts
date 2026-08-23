import { resolvePackageFromPath } from "./resolver";
import type { ModuleGraph, ModuleNode, ImportEdge } from "./types";
import type { ParsedAsset } from "./parse-assets";

/**
 * Heuristic ES/CJS import extractor, scoped per statement so one `import`
 * can never swallow another statement's specifier:
 * - `import ... from "x"`, `import "x"`, `export ... from "x"`, `import("x")`
 * - `require("x")`
 * Specifiers starting with `node:` (builtins) are skipped.
 */
const STATEMENT_RE = /\b(?:import|export)\b[^;\n]*/g;
const STRING_RE = /["']([^"']{1,512})["']/g;
const REQUIRE_RE = /\brequire\(\s*["']([^"']{1,512})["']\s*\)/g;

/** All string-literal import specifiers in a module's source text. */
export function extractImportSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const push = (spec: string | undefined): void => {
    if (spec && !spec.startsWith("node:")) specs.push(spec);
  };

  const stmtRe = new RegExp(STATEMENT_RE.source, "g");
  let stmt: RegExpExecArray | null;
  while ((stmt = stmtRe.exec(content)) !== null) {
    const strRe = new RegExp(STRING_RE.source, "g");
    let literal: RegExpExecArray | null;
    while ((literal = strRe.exec(stmt[0])) !== null) push(literal[1]);
  }

  const reqRe = new RegExp(REQUIRE_RE.source, "g");
  let req: RegExpExecArray | null;
  while ((req = reqRe.exec(content)) !== null) push(req[1]);

  return specs;
}

/**
 * Build the module-level import graph from parsed assets. Requires the maps
 * to carry `sourcesContent`; only content-bearing assets contribute edges,
 * but all asset sources still become nodes (packages + local modules).
 *
 * Module ids are canonicalized relative to their asset (`dist/assets/x.js`
 * with source `../../node_modules/y/...` → `node_modules/y/...`), which
 * dedupes the same module across chunks that share a directory.
 */
export function extractModuleGraph(assets: ParsedAsset[]): ModuleGraph {
  const nodeById = new Map<string, ModuleNode>();
  const edgeSet = new Set<string>();

  // Pass 1: register every module path as a node.
  for (const asset of assets) {
    for (const source of asset.mapSources ?? []) {
      const id = canonicalId(asset.name, source);
      if (!nodeById.has(id)) {
        const resolved = resolvePackageFromPath(id);
        nodeById.set(id, {
          id,
          pkg: resolved?.fullName,
          version: resolved?.version,
          local: resolved === null,
        });
      }
    }
  }

  // Pass 2: parse imports only where the map carried original source text.
  let hasContents = false;
  for (const asset of assets) {
    const sources = asset.mapSources ?? [];
    const contents = asset.mapContents ?? [];
    for (let i = 0; i < sources.length; i++) {
      const content = contents[i];
      if (content === undefined) continue;
      hasContents = true;
      const fromId = canonicalId(asset.name, sources[i]);
      for (const specifier of extractImportSpecifiers(content)) {
        const toId = resolveImport(specifier, fromId, nodeById);
        if (toId === null || toId === fromId) continue;
        edgeSet.add(`${fromId}\u0000${toId}`);
      }
    }
  }

  const nodes = [...nodeById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...edgeSet].map((key) => {
    const sep = key.indexOf("\u0000");
    return [key.slice(0, sep), key.slice(sep + 1)] as ImportEdge;
  });
  edges.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  const pkgModules: Record<string, string[]> = {};
  for (const node of nodes) {
    if (!node.pkg) continue;
    (pkgModules[node.pkg] ??= []).push(node.id);
  }

  return { nodes, edges, pkgModules, hasContents };
}

const SCRIPT_EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"];

/**
 * Resolve an import specifier from `fromId` against the known module set.
 * Relative specifiers resolve by path (with extension/index probing); bare
 * specifiers resolve into `node_modules/<spec>` (scoped names included).
 * Returns `null` when unresolvable.
 */
export function resolveImport(
  specifier: string,
  fromId: string,
  known: Map<string, ModuleNode> | Set<string>,
): string | null {
  const knownIds = known instanceof Map ? new Set(known.keys()) : (known as Set<string>);
  if (knownIds.size === 0) return null;

  if (specifier.startsWith(".")) {
    const base = normalizePath(joinPath(dirname(fromId), specifier));
    return matchScriptFile(base, knownIds);
  }
  const nm = findNodeModulesMatch(specifier, knownIds);
  return nm;
}

/** Match a normalized base path to a known module, trying extensions + index files. */
function matchScriptFile(base: string, known: Set<string>): string | null {
  if (known.has(base)) return base;
  for (const ext of SCRIPT_EXTS) {
    const withExt = `${base}${ext}`;
    if (known.has(withExt)) return withExt;
    const index = `${base}/index${ext}`;
    if (known.has(index)) return index;
  }
  // Longest-prefix fallback: spec points at a directory or a subpath
  // (e.g. webpack aliases) — take the most specific known descendant.
  let best: string | null = null;
  for (const id of known) {
    if (id.startsWith(`${base}/`) && (best === null || id.length < best.length)) {
      best = id;
    }
  }
  return best;
}

/** Match a bare specifier (`pkg`, `pkg/sub`, `@scope/pkg`) inside node_modules. */
function findNodeModulesMatch(specifier: string, known: Set<string>): string | null {
  // Canonical ids are relative (`node_modules/...`); some maps emit paths
  // with leading slashes or scheme prefixes (`/node_modules/...`). Try both.
  const needleRel = `node_modules/${specifier}`;
  const needleAbs = `/node_modules/${specifier}`;
  let best: string | null = null;
  for (const id of known) {
    const idx = id.indexOf(needleRel);
    const start = idx === -1 ? id.indexOf(needleAbs) : idx;
    if (start === -1) continue;
    const rest = id.slice(start + needleRel.length);
    if (rest !== "" && /^[\w$@-]/.test(rest)) continue; // e.g. "lodashish/x"
    if (best === null || id.length < best.length) best = id;
  }
  return best;
}

/** Canonical module id: asset-relative source path, normalized. */
function canonicalId(assetName: string, source: string): string {
  const dir = dirname(assetName);
  const joined = dir === "." ? source : `${dir}/${source}`;
  let normalized = normalizePath(joined);
  // Strip a leading `webpack://` style scheme prefix, if any.
  const scheme = normalized.indexOf("://");
  if (scheme !== -1) normalized = normalized.slice(scheme + 3);
  return normalized;
}

/* --- minimal POSIX path helpers (no node:path in the browser) ---------- */

export function dirname(p: string): string {
  const slash = p.lastIndexOf("/");
  if (slash === -1) return ".";
  if (slash === 0) return "/";
  return p.slice(0, slash);
}

export function joinPath(...parts: string[]): string {
  return parts.filter((p) => p !== "").join("/");
}

export function normalizePath(p: string): string {
  const segments = p.split("/");
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (out.length === 0 || out[out.length - 1] === "..") out.push(seg);
      else out.pop();
      continue;
    }
    out.push(seg);
  }
  const result = out.join("/");
  return (p.startsWith("/") ? `/` : "") + result;
}
