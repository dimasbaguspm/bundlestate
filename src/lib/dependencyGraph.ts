import type { BundleStateReport, ModuleGraph } from "./types";

/** One node in the ECharts graph series (package or module level). */
export interface DependencyGraphNode {
  id: string;
  /** Short display label. */
  name: string;
  category: "app" | "package" | "module";
  /** Weight driving the symbol size (incident edge count / import count). */
  value: number;
  /** Owning package, for module nodes. */
  pkg?: string;
}

export interface DependencyGraphEdge {
  source: string;
  target: string;
  /** Aggregated module-edge count (package level) or 1. */
  weight: number;
}

export interface DependencyGraphData {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
  /** True when edges were derived from the module import graph. */
  hasModuleData: boolean;
}

export interface ModuleSubgraphData {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
}

const APP_ID = "app";
const APP_LABEL = "app source";

/**
 * Package-level dependency graph. Preferred source: the module import graph
 * — every module→module edge is mapped to its owning package (local modules
 * collapse into a single "app source" node) and edges are aggregated by
 * weight. Without a module graph the lockfile's `pkgToSubPkg` edges are
 * used (weight 1, package-only).
 */
export function buildPackageGraph(report: BundleStateReport): DependencyGraphData {
  const graph = report.moduleGraph;
  if (graph?.hasContents && graph.edges.length >= 0) {
    return fromModuleGraph(graph, report);
  }
  return fromLockfile(report);
}

function fromModuleGraph(graph: ModuleGraph, report: BundleStateReport): DependencyGraphData {
  const packageNode = (fullName: string): DependencyGraphNode => ({
    id: fullName,
    name: fullName,
    category: "package",
    value: 0,
  });

  const nodes = new Map<string, DependencyGraphNode>([
    [APP_ID, { id: APP_ID, name: APP_LABEL, category: "app", value: 0 }],
  ]);
  for (const pkg of report.packages) nodes.set(pkg.fullName, packageNode(pkg.fullName));

  const pkgOf = new Map(graph.nodes.map((n) => [n.id, n.pkg]));
  const weights = new Map<string, number>();

  const bump = (from: string, to: string) => {
    const key = `${from}\u0000${to}`;
    weights.set(key, (weights.get(key) ?? 0) + 1);
  };

  for (const [from, to] of graph.edges) {
    const fromPkg = pkgOf.get(from);
    const toPkg = pkgOf.get(to);
    if (fromPkg !== undefined && fromPkg === toPkg) continue; // intra-package
    const source = fromPkg ?? APP_ID;
    const target = toPkg ?? APP_ID;
    if (source === target) continue; // app-internal edge
    bump(source, target);
  }

  const edges: DependencyGraphEdge[] = [];
  for (const [key, weight] of weights) {
    const sep = key.indexOf("\u0000");
    const source = key.slice(0, sep);
    const target = key.slice(sep + 1);
    if (!nodes.has(source)) nodes.set(source, packageNode(source));
    if (!nodes.has(target)) nodes.set(target, packageNode(target));
    edges.push({ source, target, weight });
  }
  edges.sort((a, b) => (a.source === b.source ? a.target.localeCompare(b.target) : a.source.localeCompare(b.source)));

  for (const { source, target, weight } of edges) {
    nodes.get(source)!.value += weight;
    nodes.get(target)!.value += weight;
  }

  return { nodes: [...nodes.values()], edges, hasModuleData: true };
}

function fromLockfile(report: BundleStateReport): DependencyGraphData {
  const nodes = new Map<string, DependencyGraphNode>();
  for (const pkg of report.packages) {
    nodes.set(pkg.fullName, { id: pkg.fullName, name: pkg.fullName, category: "package", value: 0 });
  }

  const edges: DependencyGraphEdge[] = [];
  for (const [pkg, subs] of Object.entries(report.graph.pkgToSubPkg)) {
    if (!nodes.has(pkg)) continue; // lockfile-only parent (not shipped)
    for (const sub of subs) {
      if (sub === pkg) continue;
      if (!nodes.has(sub)) {
        nodes.set(sub, { id: sub, name: sub, category: "package", value: 0 });
      }
      edges.push({ source: pkg, target: sub, weight: 1 });
    }
  }
  edges.sort((a, b) => (a.source === b.source ? a.target.localeCompare(b.target) : a.source.localeCompare(b.source)));

  for (const { source, target } of edges) {
    nodes.get(source)!.value += 1;
    nodes.get(target)!.value += 1;
  }

  return { nodes: [...nodes.values()], edges, hasModuleData: false };
}

/**
 * Drill-down data for one package: its own modules plus every direct
 * neighbour (modules connected by an edge touching the package), keeping
 * all edges between the included nodes. Returns null when the module graph
 * (or the package) is unavailable.
 */
export function buildModuleSubgraph(
  report: BundleStateReport,
  fullName: string,
): ModuleSubgraphData | null {
  const graph = report.moduleGraph;
  const memberIds = graph?.pkgModules[fullName];
  if (!graph || !memberIds || memberIds.length === 0) return null;

  const members = new Set(memberIds);
  const nodeIds = new Set<string>(memberIds);
  for (const [from, to] of graph.edges) {
    if (members.has(from)) nodeIds.add(to);
    if (members.has(to)) nodeIds.add(from);
  }

  const pkgOf = new Map(graph.nodes.map((n) => [n.id, n.pkg]));
  const degree = new Map<string, number>();
  const edges: DependencyGraphEdge[] = [];
  for (const [from, to] of graph.edges) {
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
    edges.push({ source: from, target: to, weight: 1 });
    degree.set(from, (degree.get(from) ?? 0) + 1);
    degree.set(to, (degree.get(to) ?? 0) + 1);
  }

  const nodes: DependencyGraphNode[] = [...nodeIds]
    .map((id) => ({
      id,
      name: displayModuleName(id),
      category: "module" as const,
      value: degree.get(id) ?? 0,
      pkg: pkgOf.get(id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { nodes, edges };
}

/** Short label for a module node: last path segment (unique within a package). */
function displayModuleName(id: string): string {
  const slash = id.lastIndexOf("/");
  return slash === -1 ? id : id.slice(slash + 1);
}