import type { BundleStateReport } from "./types";

/** Node shape for the ECharts treemap. */
export interface TreemapNode {
  name: string;
  value?: number;
  tooltip?: string;
  children?: TreemapNode[];
  /** ECharts item style override (used for the selected-package highlight). */
  itemStyle?: { color?: string };
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

/**
 * Fresh copy of the treemap with the node named `fullName` (any depth)
 * highlighted — used while the inspector is open for a package.
 */
export function highlightNode(nodes: TreemapNode[], fullName: string): TreemapNode[] {
  return nodes.map((node) => {
    const next: TreemapNode = { ...node, children: node.children && highlightNode(node.children, fullName) };
    if (node.name === fullName) next.itemStyle = { color: "#eecd85" };
    return next;
  });
}
