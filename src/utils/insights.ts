import { findCircularGroups } from "./cycles";
import { resolvePackageFromPath } from "./resolver";
import type { Asset, DeclaredDeps, Insights, ModuleGraph, Package, VersionClash } from "./types";

export interface InsightsInput {
  assets: Asset[];
  packages: Package[];
  declaredDeps: DeclaredDeps;
  /** Raw per-asset map source paths (path-level version clash detection). */
  rawMapSources?: string[][];
  /** Module-level graph, when source content was available. */
  moduleGraph?: ModuleGraph;
}

const LARGEST_COUNT = 5;

/**
 * Insight engine: flags declared-but-unshipped dependencies, duplicate
 * package versions, local import cycles and computes aggregate gzip ratio
 * plus the largest assets.
 */
export function computeInsights(input: InsightsInput): Insights {
  const shipped = new Set(input.packages.map((p) => p.fullName));

  const declared = new Map<string, string>();
  for (const [name, range] of [
    ...Object.entries(input.declaredDeps.dependencies),
    ...Object.entries(input.declaredDeps.devDependencies),
  ]) {
    declared.set(name, range);
  }
  const unusedDeclaredDeps = [...declared.keys()].filter((name) => !shipped.has(name)).sort();

  const totalSizeBytes = input.assets.reduce((sum, a) => sum + a.sizeBytes, 0);
  const gzipKnown = input.assets.every((a) => a.gzipBytes !== null);
  const totalGzipBytes = gzipKnown
    ? input.assets.reduce((sum, a) => sum + (a.gzipBytes ?? 0), 0)
    : null;
  const gzipRatio =
    totalSizeBytes > 0 && totalGzipBytes !== null ? totalGzipBytes / totalSizeBytes : null;

  const largestAssets = [...input.assets]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, LARGEST_COUNT)
    .map((a) => a.name);

  const { moduleGraph: graph, rawMapSources } = input;
  const versionClashes = computeVersionClashes(rawMapSources ?? [], graph);

  const circularDepGroups = graph ? findCircularGroups(graph.nodes, graph.edges) : [];
  const circularDepCount = circularDepGroups.length;

  const lineage = graph
    ? {
        available: graph.hasContents,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        reason: graph.hasContents
          ? undefined
          : "Source maps carry no sourcesContent — module-level lineage unavailable; package-level analysis only.",
      }
    : {
        available: false,
        nodes: 0,
        edges: 0,
        reason: "No source maps with content were found.",
      };

  return {
    unusedDeclaredDeps,
    gzipRatio,
    largestAssets,
    totalSizeBytes,
    totalGzipBytes,
    versionClashes,
    circularDepGroups,
    circularDepCount,
    lineage,
  };
}

/**
 * Detect packages bundled in more than one version. Detection is
 * path-level (pnpm virtual-store versions); when a module graph exists the
 * importing parent packages are attached per version.
 */
export function computeVersionClashes(
  rawMapSources: string[][],
  graph?: ModuleGraph,
): VersionClash[] {
  const byName = new Map<string, Map<string, Set<string>>>();

  for (const sources of rawMapSources) {
    for (const source of sources ?? []) {
      const resolved = resolvePackageFromPath(source);
      if (!resolved?.version) continue;
      let byVersion = byName.get(resolved.fullName);
      if (!byVersion) {
        byVersion = new Map();
        byName.set(resolved.fullName, byVersion);
      }
      if (!byVersion.has(resolved.version)) byVersion.set(resolved.version, new Set());
    }
  }

  if (graph) {
    const importers = buildImporterMap(graph.edges);
    const nodeByVersion = new Map<string, Set<string>>(); // `${fullName}\u0000${version}` -> module ids
    for (const node of graph.nodes) {
      if (!node.pkg || !node.version) continue;
      const key = `${node.pkg}\u0000${node.version}`;
      const set = nodeByVersion.get(key);
      if (set) set.add(node.id);
      else nodeByVersion.set(key, new Set([node.id]));
    }

    for (const [fullName, byVersion] of byName) {
      for (const [version, parents] of byVersion) {
        const moduleIds = nodeByVersion.get(`${fullName}\u0000${version}`) ?? [];
        for (const moduleId of moduleIds) {
          for (const importer of importers.get(moduleId) ?? []) {
            const importerNode = graph.nodes.find((n) => n.id === importer);
            if (importerNode?.pkg && importerNode.pkg !== fullName) {
              parents.add(importerNode.pkg);
            }
          }
        }
      }
    }
  }

  return [...byName.entries()]
    .filter(([, byVersion]) => byVersion.size > 1)
    .map(([fullName, byVersion]) => ({
      fullName,
      versions: [...byVersion.entries()]
        .map(([version, parents]) => ({ version, importedBy: [...parents].sort() }))
        .sort((a, b) => a.version.localeCompare(b.version)),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** Importers per module id. */
function buildImporterMap(edges: ModuleGraph["edges"]): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const [from, to] of edges) {
    const list = incoming.get(to);
    if (list) list.push(from);
    else incoming.set(to, [from]);
  }
  return incoming;
}
