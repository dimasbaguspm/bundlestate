import { describe, expect, it } from "vitest";
import { layoutDependencyGraph } from "./dep-graph-layout";
import type { ModuleNode } from "@/utils/types";

const node = (id: string, local = true): ModuleNode => ({
  id,
  local,
  pkg: local ? undefined : "x",
});

describe("layoutDependencyGraph", () => {
  it("returns empty layout for no nodes", () => {
    const l = layoutDependencyGraph([], [], []);
    expect(l.nodes).toHaveLength(0);
    expect(l.links).toHaveLength(0);
  });

  it("positions nodes within the viewport and flags cycle members", () => {
    const nodes: ModuleNode[] = [node("a"), node("b"), node("c"), node("vendor/dep", false)];
    const edges: [string, string][] = [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"], // cycle a→b→c→a
    ];
    const l = layoutDependencyGraph(nodes, edges, [["a", "b", "c"]]);
    expect(l.nodes).toHaveLength(4);
    expect(l.links).toHaveLength(3);
    for (const n of l.nodes) {
      expect(n.x!).toBeGreaterThanOrEqual(16);
      expect(n.x!).toBeLessThanOrEqual(720);
      expect(n.y!).toBeGreaterThanOrEqual(16);
      expect(n.y!).toBeLessThanOrEqual(460);
    }
    const a = l.nodes.find((n) => n.id === "a")!;
    const vendor = l.nodes.find((n) => n.id === "vendor/dep")!;
    expect(a.inCycle).toBe(true);
    expect(vendor.inCycle).toBe(false);
  });

  it("marks cycle edges when both endpoints are in a cycle", () => {
    const nodes: ModuleNode[] = [node("a"), node("b"), node("c")];
    const edges: [string, string][] = [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ];
    const l = layoutDependencyGraph(nodes, edges, [["a", "b", "c"]]);
    const cycleEdge = l.links.find((e) => e.source === "a" && e.target === "b");
    expect(cycleEdge?.inCycle).toBe(true);
    const nonCycle = l.links.find((e) => e.source === "b" && e.target === "c");
    expect(nonCycle?.inCycle).toBe(true);
  });
});
