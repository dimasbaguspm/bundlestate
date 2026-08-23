import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
import type { ImportEdge, ModuleNode } from "@/lib/types";

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  /** True when the node participates in a circular dependency. */
  inCycle: boolean;
  local: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  inCycle: boolean;
}

export interface DepGraphLayout {
  nodes: GraphNode[];
  links: GraphLink[];
  width: number;
  height: number;
}

/**
 * Compute a force-directed layout for the module import graph. Cycle members
 * (from `circularDepGroups`) are flagged so the view can highlight them.
 * The simulation runs synchronously for a fixed number of ticks so the result
 * is deterministic and ready to render without animation frame loops.
 */
export function layoutDependencyGraph(
  nodes: ModuleNode[],
  edges: ImportEdge[],
  circularDepGroups: string[][],
  width = 720,
  height = 460,
): DepGraphLayout {
  const cycleMembers = new Set<string>();
  for (const g of circularDepGroups) for (const m of g) cycleMembers.add(m);

  const simNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    label: shortLabel(n.id),
    inCycle: cycleMembers.has(n.id),
    local: n.local,
  }));

  const simLinks: GraphLink[] = edges.map(([from, to]) => ({
    source: from,
    target: to,
    inCycle: cycleMembers.has(from) && cycleMembers.has(to),
  }));

  if (simNodes.length === 0) {
    return { nodes: [], links: [], width, height };
  }

  const sim = forceSimulation(simNodes)
    .force("charge", forceManyBody().strength(-180))
    .force(
      "link",
      forceLink<GraphNode, GraphLink>(simLinks)
        .id((d) => d.id)
        .distance(60)
        .strength(0.4),
    )
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide(14))
    .stop();

  const ticks = Math.min(300, 80 + simNodes.length * 3);
  for (let i = 0; i < ticks; i++) sim.tick();

  // Clamp into the viewport.
  for (const n of simNodes) {
    n.x = Math.max(16, Math.min(width - 16, n.x ?? width / 2));
    n.y = Math.max(16, Math.min(height - 16, n.y ?? height / 2));
  }

  // d3-force mutates link.source/target into node objects; normalize back to
  // ids so consumers (the SVG view) can index the node map.
  const outLinks: GraphLink[] = simLinks.map((l) => ({
    source: typeof l.source === "string" ? l.source : (l.source as GraphNode).id,
    target: typeof l.target === "string" ? l.target : (l.target as GraphNode).id,
    inCycle: l.inCycle,
  }));

  return { nodes: simNodes, links: outLinks, width, height };
}

function shortLabel(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1] || id;
}
