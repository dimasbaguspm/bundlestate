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
  /** Shipped package name (same as `id` unless version-qualified). */
  fullName?: string;
  /** Shipped version, present when a package ships multiple versions. */
  version?: string;
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

const APP_ID = "app";
const APP_LABEL = "app source";

/** Bare package node fallback (edge-only reference that was not seeded). */
function barePackageNode(id: string): DependencyGraphNode {
  return { id, name: id, category: "package", value: 0, fullName: id };
}

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
  const versioned = versionedPackages(report);
  const nodeId = (fullName: string, version?: string): string =>
    versioned.has(fullName) && version ? `${fullName}@${version}` : fullName;

  const nodes = new Map<string, DependencyGraphNode>([
    [APP_ID, { id: APP_ID, name: APP_LABEL, category: "app", value: 0 }],
  ]);
  const ensure = (fullName: string, version?: string): string => {
    const id = nodeId(fullName, version);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        name: id,
        category: "package",
        value: 0,
        fullName,
        version: versioned.has(fullName) ? version : undefined,
      });
    }
    return id;
  };
  // Seed every shipped package so isolated/leaf packages always appear.
  for (const pkg of report.packages) ensure(pkg.fullName, pkg.version);

  const info = new Map(graph.nodes.map((n) => [n.id, { pkg: n.pkg, version: n.version }]));
  const weights = new Map<string, number>();

  const bump = (from: string, to: string) => {
    const key = `${from}\u0000${to}`;
    weights.set(key, (weights.get(key) ?? 0) + 1);
  };

  for (const [from, to] of graph.edges) {
    const fromInfo = info.get(from);
    const toInfo = info.get(to);
    // Skip edges fully inside the same package @ the same version.
    if (
      fromInfo?.pkg !== undefined &&
      fromInfo.pkg === toInfo?.pkg &&
      fromInfo.version === toInfo?.version
    ) {
      continue;
    }
    const source = fromInfo?.pkg ? ensure(fromInfo.pkg, fromInfo.version) : APP_ID;
    const target = toInfo?.pkg ? ensure(toInfo.pkg, toInfo.version) : APP_ID;
    if (source === target) continue; // app-internal edge
    bump(source, target);
  }

  const edges: DependencyGraphEdge[] = [];
  for (const [key, weight] of weights) {
    const sep = key.indexOf("\u0000");
    const source = key.slice(0, sep);
    const target = key.slice(sep + 1);
    if (!nodes.has(source)) nodes.set(source, barePackageNode(source));
    if (!nodes.has(target)) nodes.set(target, barePackageNode(target));
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
  const versioned = versionedPackages(report);
  const nodeId = (fullName: string, version?: string): string =>
    versioned.has(fullName) && version ? `${fullName}@${version}` : fullName;
  const versionOf = (fullName: string): string | undefined =>
    report.packages.find((p) => p.fullName === fullName)?.version;

  const nodes = new Map<string, DependencyGraphNode>();
  const ensure = (fullName: string, version?: string): string => {
    const id = nodeId(fullName, version);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        name: id,
        category: "package",
        value: 0,
        fullName,
        version: versioned.has(fullName) ? version : undefined,
      });
    }
    return id;
  };
  for (const pkg of report.packages) ensure(pkg.fullName, pkg.version);

  const edges: DependencyGraphEdge[] = [];
  for (const [pkg, subs] of Object.entries(report.graph.pkgToSubPkg)) {
    if (!nodes.has(pkg) && !versioned.has(pkg)) continue; // lockfile-only parent (not shipped)
    for (const sub of subs) {
      if (sub === pkg) continue;
      const parent = versioned.has(pkg) ? ensure(pkg, versionOf(pkg)) : pkg;
      const target = versioned.has(sub) ? ensure(sub, versionOf(sub)) : ensure(sub);
      edges.push({ source: parent, target, weight: 1 });
    }
  }
  edges.sort((a, b) => (a.source === b.source ? a.target.localeCompare(b.target) : a.source.localeCompare(b.source)));

  for (const { source, target } of edges) {
    nodes.get(source)!.value += 1;
    nodes.get(target)!.value += 1;
  }

  return { nodes: [...nodes.values()], edges, hasModuleData: false };
}

/** Package fullNames that ship more than one distinct version. */
function versionedPackages(report: BundleStateReport): Set<string> {
  const byName = new Map<string, Set<string>>();
  for (const pkg of report.packages) {
    if (!byName.has(pkg.fullName)) byName.set(pkg.fullName, new Set());
    byName.get(pkg.fullName)!.add(pkg.version ?? "");
  }
  const out = new Set<string>();
  for (const [name, versions] of byName) if (versions.size > 1) out.add(name);
  return out;
}