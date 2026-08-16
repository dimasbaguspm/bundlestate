import { findInlineMap, findSidecarEntry, findSidecarRef, parseSourceMap } from "./sourcemap";
import type { ZipEntry } from "./zip";

/** An asset + optional source-map module paths, ready for normalization. */
export interface ParsedAsset {
  name: string;
  sizeBytes: number;
  bytes: Uint8Array;
  mapSources?: string[];
}

const DECODER = new TextDecoder();

const ASSET_SUFFIXES = [".js", ".mjs", ".cjs"];

/**
 * Turn extracted zip entries into parse assets. Every `.js`/`.mjs`/`.cjs`
 * entry (outside `node_modules`) is inspected for a source map — inline
 * `data:application/json;base64,...` comments or a sidecar `.map` entry —
 * and the map's `sources` are kept for package-name resolution downstream.
 */
export function collectAssets(entries: ZipEntry[]): ParsedAsset[] {
  const names = entries.map((e) => e.name);
  const assets: ParsedAsset[] = [];

  for (const entry of entries) {
    if (!isAssetName(entry.name)) continue;
    const text = DECODER.decode(entry.bytes);
    const mapSources = findMapSources(entry.name, text, entries, names);
    assets.push({ name: entry.name, sizeBytes: entry.sizeBytes, bytes: entry.bytes, mapSources });
  }

  return assets;
}

function findMapSources(
  assetName: string,
  content: string,
  entries: ZipEntry[],
  entryNames: string[],
): string[] | undefined {
  const inline = findInlineMap(content);
  if (inline !== null) return parseSourceMap(inline).sources;

  const ref = findSidecarRef(content);
  let mapEntry: ZipEntry | undefined;
  if (ref) {
    mapEntry = entries.find((e) => e.name === ref || e.name.endsWith(`/${ref}`));
  }
  if (!mapEntry) {
    const sidecarName = findSidecarEntry(assetName, entryNames);
    if (sidecarName) mapEntry = entries.find((e) => e.name === sidecarName);
  }
  if (!mapEntry) return undefined;

  try {
    return parseSourceMap(DECODER.decode(mapEntry.bytes)).sources;
  } catch {
    return undefined;
  }
}

function isAssetName(name: string): boolean {
  if (name.includes("node_modules/")) return false;
  if (name.endsWith(".map")) return false;
  return ASSET_SUFFIXES.some((suffix) => name.endsWith(suffix));
}
