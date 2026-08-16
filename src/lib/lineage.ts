import type { ImportEdge, ModuleGraph } from "./types";

export interface LineageChain {
  /** Module ids from the nearest entry-ish root to the target. */
  modules: string[];
}

export interface LineageResult {
  chains: LineageChain[];
  /** Total number of distinct reverse paths found (may exceed chains.length). */
  totalPaths: number;
  /** Module ids that could not be reached from any entry. */
  orphaned: string[];
}

const MAX_CHAINS = 5;
const MAX_DEPTH = 40;

/**
 * "Why is this here?" trace: walk the module graph BACKWARD from the given
 * target module ids, following importer edges, to application roots. Each
 * chain shows one concrete import path: `src/Dashboard.tsx → react-chartjs-2
 * → chart.js → target`. Only local modules count as roots (an entry point
 * is a local module nobody imports); chains are shortest-first.
 */
export function findLineages(
  graph: ModuleGraph,
  targetIds: string[],
): LineageResult {
  const targets = new Set(targetIds);
  const incoming = buildReverseEdges(graph.edges);

  // Reverse-reachable set.
  const reachable = new Set<string>(targets);
  const queue = [...targets];
  while (queue.length > 0 && reachable.size < 200_000) {
    const id = queue.shift()!;
    for (const parent of incoming.get(id) ?? []) {
      if (!reachable.has(parent)) {
        reachable.add(parent);
        queue.push(parent);
      }
    }
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const roots = [...reachable].filter(
    (id) => !incoming.has(id) || incoming.get(id)!.length === 0,
  );

  const chains: LineageChain[] = [];
  let totalPaths = 0;

  for (const root of roots) {
    if (chains.length >= MAX_CHAINS) break;
    const path = bfsShortestPath(root, targets, graph.edges, MAX_DEPTH);
    if (path === null) continue;
    totalPaths++;
    const pruned = pruneSamePackageRun(path, byId);
    if (pruned.length > 1) chains.push({ modules: pruned });
  }

  // If the target is unreachable from any root it is still worth showing
  // the target itself plus any direct importers.
  if (chains.length === 0) {
    const direct = incoming.get(targetIds[0] ?? "") ?? [];
    if (direct.length > 0) {
      const pruned = pruneSamePackageRun(direct.slice(0, MAX_DEPTH), byId);
      if (targetIds.length > 0) pruned.push(targetIds[0]);
      if (pruned.length > 1) chains.push({ modules: pruned });
    }
  }

  const orphaned = [...targets].filter((id) => !incoming.has(id));
  return { chains, totalPaths: Math.max(totalPaths, chains.length), orphaned };
}

/** Importers per module id. */
function buildReverseEdges(edges: ImportEdge[]): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const [from, to] of edges) {
    const list = incoming.get(to);
    if (list) list.push(from);
    else incoming.set(to, [from]);
  }
  return incoming;
}

function bfsShortestPath(
  root: string,
  targets: Set<string>,
  edges: ImportEdge[],
  maxDepth: number,
): string[] | null {
  const outgoing = new Map<string, string[]>();
  for (const [from, to] of edges) {
    const list = outgoing.get(from);
    if (list) list.push(to);
    else outgoing.set(from, [to]);
  }
  const parent = new Map<string, string | null>([[root, null]]);
  const queue = [root];
  const endAt = (node: string): string[] => {
    const path: string[] = [];
    let cur: string | null = node;
    while (cur !== null) {
      path.push(cur);
      cur = parent.get(cur) ?? null;
    }
    return path.reverse();
  };

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const depth = parent.get(cur) === null ? 0 : pathDepth(parent, cur);
    if (depth >= maxDepth) continue;
    for (const next of outgoing.get(cur) ?? []) {
      if (parent.has(next)) continue;
      parent.set(next, cur);
      if (targets.has(next)) return endAt(next);
      queue.push(next);
    }
  }
  return null;
}

function pathDepth(parent: Map<string, string | null>, node: string): number {
  let depth = 0;
  let cur: string | null = node;
  while (cur !== null && parent.get(cur) !== null) {
    depth++;
    cur = parent.get(cur) ?? null;
    if (depth > 1000) break;
  }
  return depth;
}

/** Collapse consecutive modules that belong to the same package. */
function pruneSamePackageRun(
  path: string[],
  byId: Map<string, { pkg?: string }>,
): string[] {
  const out: string[] = [];
  for (const id of path) {
    const pkg = byId.get(id)?.pkg;
    const prev = byId.get(out[out.length - 1] ?? "")?.pkg;
    if (pkg !== undefined && pkg === prev) continue;
    out.push(id);
  }
  return out;
}