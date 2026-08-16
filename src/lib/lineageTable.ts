import type { BundleStateReport } from "./types";
import { buildPackageGraph } from "./dependencyGraph";

/** One node in the reverse-dependency tree (a dependant of its parent). */
export interface LineageTreeNode {
  fullName: string;
  version?: string;
  isApp?: boolean;
  children: LineageTreeNode[];
}

/** A top-level package row with its expandable dependant tree. */
export interface LineageTableRow {
  fullName: string;
  version?: string;
  usedByCount: number;
  children: LineageTreeNode[];
}

export const APP_NODE = "app";

/**
 * Build the expandable dependant table for every shipped package. Using the
 * package dependency graph's edges (source imports target), a package's
 * dependants are the reverse edges walked up to the `app` pseudo-node — so a
 * package shows who uses it, transitively (e.g. `baz` → `bar` → `foo` → `app`).
 * Cycle-safe via a visited set. Rows sort by dependant count descending.
 */
export function buildLineageTable(report: BundleStateReport, query = ""): LineageTableRow[] {
  const versionOf = new Map(report.packages.map((p) => [p.fullName, p.version]));
  const reverse = new Map<string, Set<string>>();
  for (const edge of buildPackageGraph(report).edges) {
    if (!reverse.has(edge.target)) reverse.set(edge.target, new Set());
    reverse.get(edge.target)!.add(edge.source);
  }
  const dependantsOf = (name: string): string[] => [...(reverse.get(name) ?? [])].sort();

  const buildNode = (name: string, visited: Set<string>): LineageTreeNode => {
    const next = new Set(visited);
    next.add(name);
    const children = dependantsOf(name)
      .filter((d) => !visited.has(d))
      .map((d) => buildNode(d, next));
    return {
      fullName: name,
      version: versionOf.get(name),
      isApp: name === APP_NODE,
      children,
    };
  };

  const q = query.trim().toLowerCase();
  return report.packages
    .map((pkg) => {
      const children = buildNode(pkg.fullName, new Set()).children;
      return {
        fullName: pkg.fullName,
        version: pkg.version,
        usedByCount: countNodes(children),
        children,
      };
    })
    .filter((row) => !q || row.fullName.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        b.usedByCount - a.usedByCount || a.fullName.localeCompare(b.fullName),
    );
}

/** Total nodes in a dependant tree (direct + transitive, up to app). */
function countNodes(nodes: LineageTreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}
