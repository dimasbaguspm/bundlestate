import { resolvePackageFromPath } from "./resolver";

export interface SourceMapFile {
  sources: string[];
}

/**
 * Matches `//# sourceMappingURL=data:application/json;base64,<payload>`
 * (and `//@` / block-comment variants, optional `;charset=` parameter).
 */
const INLINE_MAP_RE =
  /\/\/[#@]\s*sourceMappingURL=data:application\/json(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)/;

/** Matches `//# sourceMappingURL=<path>` for a sidecar file reference. */
const SIDECAR_REF_RE = /\/\/[#@]\s*sourceMappingURL=([^\s*]+)/;

const DECODER = new TextDecoder();

/**
 * Extract the decoded JSON of an inline base64 source map from bundle text,
 * or `null` when the file carries no inline map.
 */
export function findInlineMap(text: string): string | null {
  const match = INLINE_MAP_RE.exec(text);
  if (!match) return null;
  try {
    return DECODER.decode(base64ToBytes(match[1]));
  } catch {
    return null;
  }
}

/**
 * Extract the path referenced by a `sourceMappingURL=` comment, or `null`
 * when the comment points at an inline data URL or is absent.
 */
export function findSidecarRef(text: string): string | null {
  const match = SIDECAR_REF_RE.exec(text);
  if (!match) return null;
  const ref = match[1].trim();
  if (ref.startsWith("data:")) return null;
  return ref;
}

/**
 * Locate the zip entry that holds the sidecar map for `assetName`.
 * Handles both `<path>.js.map` (full path) and `<basename>.js.map`
 * (basename) conventions.
 */
export function findSidecarEntry(assetName: string, entryNames: string[]): string | null {
  const fullPath = `${assetName}.map`;
  if (entryNames.includes(fullPath)) return fullPath;

  const slash = assetName.lastIndexOf("/");
  const basename = slash === -1 ? assetName : assetName.slice(slash + 1);
  const byBasename = entryNames.find((name) => {
    const theirSlash = name.lastIndexOf("/");
    const theirBase = theirSlash === -1 ? name : name.slice(theirSlash + 1);
    return theirBase === `${basename}.map`;
  });
  return byBasename ?? null;
}

/** Parse a source map JSON payload, tolerating malformed input. */
export function parseSourceMap(json: string): SourceMapFile {
  try {
    const parsed = JSON.parse(json) as Partial<SourceMapFile> | null;
    const sources = Array.isArray(parsed?.sources)
      ? parsed.sources.filter((s): s is string => typeof s === "string")
      : [];
    return { sources };
  } catch {
    return { sources: [] };
  }
}

/**
 * Resolve the set of packages a list of source-map `sources` paths belongs
 * to. Application code (paths outside `node_modules`) is filtered out.
 */
export function usedModulesFromSources(sources: string[]): string[] {
  const seen = new Set<string>();
  const modules: string[] = [];
  for (const source of sources) {
    const resolved = resolvePackageFromPath(source);
    if (resolved && !seen.has(resolved.fullName)) {
      seen.add(resolved.fullName);
      modules.push(resolved.fullName);
    }
  }
  return modules;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
