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