import type { BundleStateReport } from "./types";

/** One node in the dependencies tree: a shipped package + its own deps. */
export interface DependencyNode {
  fullName: string;
  version?: string;
  children: DependencyNode[];
}

const MAX_DEPTH = 8;

/**
 * Build the "Dependencies and Dependencies of the Dependencies" tree from the
 * lockfile's `pkgToSubPkg` edges (each shipped package and its transitive
 * sub-dependencies). Cycle-safe via a visited set; depth-bounded. When `query`
 * is set, only branches whose name matches (case-insensitive substring) are
 * kept — a parent is shown only if it matches or has a matching descendant.
 */
export function buildDependencyTree(
  report: BundleStateReport,
  query = "",
): DependencyNode[] {
  const versionOf = new Map(report.packages.map((p) => [p.fullName, p.version]));
  const edges = report.graph.pkgToSubPkg;
  const q = query.trim().toLowerCase();

  const build = (name: string, visited: Set<string>, depth: number): DependencyNode | null => {
    if (depth > MAX_DEPTH || visited.has(name)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(name);
    const children = (edges[name] ?? [])
      .map((child) => (child === name ? null : build(child, nextVisited, depth + 1)))
      .filter((n): n is DependencyNode => n !== null);
    const matches = !q || name.toLowerCase().includes(q);
    if (!matches && children.length === 0) return null;
    return { fullName: name, version: versionOf.get(name), children };
  };

  const roots = new Set<string>();
  for (const [pkg, subs] of Object.entries(edges)) if (subs.length > 0) roots.add(pkg);
  for (const pkg of report.packages) roots.add(pkg.fullName);

  return [...roots]
    .map((root) => build(root, new Set(), 0))
    .filter((n): n is DependencyNode => n !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
