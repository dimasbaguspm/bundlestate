import type { BundleStateReport } from "./types";

/** Node shape for the ECharts treemap. */
export interface TreemapNode {
  name: string;
  value?: number;
  tooltip?: string;
  children?: TreemapNode[];
}

/**
 * Build the treemap hierarchy: assets at level 1 (sized by `sizeBytes`),
 * packages at level 2 (approximate per-asset share — per-package byte sizes
 * are not derivable from source maps alone).
 */
export function buildTreemap(report: BundleStateReport): TreemapNode[] {
  return report.assets.map((asset) => {
    const children =
      asset.usedModules.length > 0
        ? asset.usedModules.map((pkg) => ({
            name: pkg,
            value: asset.sizeBytes / asset.usedModules.length,
            tooltip: `${pkg} — approx. ${Math.round(asset.sizeBytes / asset.usedModules.length).toLocaleString()} B in ${asset.name}`,
          }))
        : undefined;
    return {
      name: asset.name,
      value: asset.sizeBytes,
      tooltip: `${asset.name} — ${asset.sizeBytes.toLocaleString()} bytes (${asset.usedModules.length} packages)`,
      children,
    };
  });
}
