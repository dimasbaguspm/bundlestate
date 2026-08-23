import type { BundlerKind } from "./types";

const PNPM_MARKER = /\.pnpm\//;
const NODE_MODULES_MARKER = /node_modules\//;

/**
 * Identify the bundler/package-layout that produced a bundle from a set of
 * paths (zip entry names and/or source-map `sources`).
 *
 * - pnpm virtual-store paths imply a pnpm layout (`source: 'pnpm'`)
 * - plain `node_modules/<pkg>` paths imply a flat node_modules layout,
 *   mapped to `source: 'webpack'` (npm/yarn installs feeding webpack)
 * - otherwise `'unknown'`
 */
export function detectBundler(paths: Iterable<string>): BundlerKind {
  let sawNodeModules = false;
  for (const path of paths) {
    if (PNPM_MARKER.test(path)) return "pnpm";
    if (NODE_MODULES_MARKER.test(path)) sawNodeModules = true;
  }
  return sawNodeModules ? "webpack" : "unknown";
}
