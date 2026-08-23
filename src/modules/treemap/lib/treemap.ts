import {
  hierarchy,
  treemap,
  treemapSquarify,
  type HierarchyNode,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import type { BundleStateReport } from "@/utils/types";

/** A rendered treemap rectangle (asset at depth 1, package at depth 2). */
export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  fullName?: string;
  /** True for package leaves. */
  isPackage: boolean;
}

interface Datum {
  name: string;
  value: number;
  fullName?: string;
  children?: Datum[];
}

/**
 * Build the treemap hierarchy: an asset root per chunk, package leaves sized
 * by their per-asset share (`asset.sizeBytes / usedModules.length`). A `query`
 * keeps only matching package leaves and drops assets with none.
 */
export function buildTreemapData(report: BundleStateReport, query = ""): Datum {
  const q = query.trim().toLowerCase();
  const children: Datum[] = [];
  for (const asset of report.assets) {
    const modules = asset.usedModules.filter((pkg) => !q || pkg.toLowerCase().includes(q));
    if (modules.length === 0) continue;
    const share = asset.sizeBytes / modules.length;
    children.push({
      name: asset.name,
      value: asset.sizeBytes,
      children: modules.map((pkg) => ({ name: pkg, fullName: pkg, value: share })),
    });
  }
  return {
    name: report.sourceName,
    value: children.reduce((s, c) => s + c.value, 0),
    children,
  };
}

/**
 * Run the treemap layout over the report at a given pixel size and return the
 * rectangles to draw. Leaves are sized proportionally to their value, so a
 * bigger package occupies a bigger area.
 */
export function layoutTreemap(
  report: BundleStateReport,
  width: number,
  height: number,
  query = "",
): TreemapRect[] {
  if (width <= 0 || height <= 0) return [];
  const root = hierarchy<Datum>(buildTreemapData(report, query));
  root.sum((d) => d.value).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap<Datum>()
    .tile(treemapSquarify.ratio(1))
    .size([width, height])
    .paddingInner(1)
    .paddingOuter(2)
    .round(true)(root);

  const rects: TreemapRect[] = [];
  root.each((node: HierarchyNode<Datum>) => {
    if (node.depth === 0) return; // the whole-report root
    const r = node as HierarchyRectangularNode<Datum>;
    rects.push({
      x: r.x0,
      y: r.y0,
      width: r.x1 - r.x0,
      height: r.y1 - r.y0,
      name: r.data.name,
      fullName: r.data.fullName,
      isPackage: node.depth === 2,
    });
  });
  return rects;
}
