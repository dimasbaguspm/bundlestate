import type { ImportEdge, ModuleNode } from "./types";

/**
 * Detect cycles in the module graph via Tarjan's strongly-connected
 * components. Only LOCAL (application) modules are considered — cycles
 * through `node_modules` are usually webpack/rollup artifacts rather than
 * real application bugs. Each returned group is one cycle's members,
 * sorted by group size (largest first) then lexically.
 */
export function findCircularGroups(
  nodes: ModuleNode[],
  edges: ImportEdge[],
): string[][] {
  const nodeIds = nodes.filter((n) => n.local).map((n) => n.id);
  const idIndex = new Map<string, number>();
  nodeIds.forEach((id, i) => idIndex.set(id, i));

  const adjacency: number[][] = nodeIds.map(() => []);
  for (const [from, to] of edges) {
    const f = idIndex.get(from);
    const t = idIndex.get(to);
    if (f !== undefined && t !== undefined) adjacency[f].push(t);
  }

  const index = new Array<number>(nodeIds.length).fill(-1);
  const low = new Array<number>(nodeIds.length).fill(0);
  const onStack = new Array<boolean>(nodeIds.length).fill(false);
  const stack: number[] = [];
  const groups: string[][] = [];
  let counter = 0;

  const strongconnect = (v: number): void => {
    index[v] = low[v] = counter++;
    stack.push(v);
    onStack[v] = true;

    for (const w of adjacency[v]) {
      if (index[w] === -1) {
        strongconnect(w);
        low[v] = Math.min(low[v], low[w]);
      } else if (onStack[w]) {
        low[v] = Math.min(low[v], index[w]);
      }
    }

    if (low[v] === index[v]) {
      const component: number[] = [];
      let w: number;
      do {
        w = stack.pop()!;
        onStack[w] = false;
        component.push(w);
      } while (w !== v);
      if (component.length > 1) {
        groups.push(component.map((n) => nodeIds[n]).sort());
      }
    }
  };

  for (let v = 0; v < nodeIds.length; v++) {
    if (index[v] === -1) strongconnect(v);
  }

  groups.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  return groups;
}

/**
 * Order the members of one circular group into a closed path
 * (A → B → C → A) by walking the actual import edges. Returns the node ids in
 * traversal order, with the first node repeated at the end to make the loop
 * explicit for the step-by-step trace UI (PRD §4.4.2). When the edges don't
 * form a perfect ring (e.g. a figure-eight SCC), it falls back to the given
 * group order, still closing back to the start.
 */
export function traceCycle(group: string[], edges: ImportEdge[]): string[] {
  if (group.length < 2) return [...group];
  const adj = new Map<string, string[]>();
  for (const id of group) adj.set(id, []);
  for (const [from, to] of edges) {
    if (adj.has(from) && adj.has(to)) adj.get(from)!.push(to);
  }
  const path: string[] = [group[0]];
  const seen = new Set<string>([group[0]]);
  let current = group[0];
  for (let step = 0; step < group.length; step++) {
    const next = (adj.get(current) ?? []).find((n) => !seen.has(n) || n === group[0]);
    if (!next) break;
    path.push(next);
    if (next === group[0]) break;
    seen.add(next);
    current = next;
  }
  // guarantee closure back to start
  if (path[path.length - 1] !== group[0]) path.push(group[0]);
  return path;
}