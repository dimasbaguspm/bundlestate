import { describe, expect, it } from "vitest";
import { buildDependencyTree } from "./dependencies";
import type { BundleStateReport } from "./types";

function report(graph: BundleStateReport["graph"]): BundleStateReport {
  return {
    id: "r",
    sourceName: "app.zip",
    generatedAt: new Date().toISOString(),
    assets: [],
    packages: [
      { name: "a", fullName: "a", version: "1.0.0", source: "pnpm", usedIn: [] },
      { name: "b", fullName: "b", version: "2.0.0", source: "pnpm", usedIn: [] },
      { name: "c", fullName: "c", version: "3.0.0", source: "pnpm", usedIn: [] },
      { name: "d", fullName: "d", version: "4.0.0", source: "pnpm", usedIn: [] },
    ],
    declaredDeps: { dependencies: {}, devDependencies: {}, peerDependencies: {} },
    lockfile: { format: "pnpm", packageCount: 0, rawName: "pnpm-lock.yaml" },
    graph,
    insights: {
      unusedDeclaredDeps: [],
      gzipRatio: null,
      largestAssets: [],
      totalSizeBytes: 0,
      totalGzipBytes: null,
      versionClashes: [],
      circularDepGroups: [],
      circularDepCount: 0,
      lineage: { available: false, nodes: 0, edges: 0 },
    },
  };
}

describe("buildDependencyTree", () => {
  const graph = {
    appToPkg: { app: ["a", "b"] },
    pkgToSubPkg: { a: ["c"], c: ["d"], b: [], d: [] },
  };

  it("lists dependencies and dependencies-of-dependencies", () => {
    const tree = buildDependencyTree(report(graph));
    const a = tree.find((n) => n.fullName === "a")!;
    expect(a.children.map((c) => c.fullName)).toEqual(["c"]);
    expect(a.children[0].children.map((c) => c.fullName)).toEqual(["d"]);
    // b has no sub-dependencies
    expect(tree.find((n) => n.fullName === "b")!.children).toEqual([]);
  });

  it("keeps versions for shipped packages", () => {
    const tree = buildDependencyTree(report(graph));
    expect(tree.find((n) => n.fullName === "a")!.version).toBe("1.0.0");
    expect(tree.find((n) => n.fullName === "d")!.version).toBe("4.0.0");
  });

  it("does not loop on cycles", () => {
    const cyclic = report({
      appToPkg: { app: ["x"] },
      pkgToSubPkg: { x: ["y"], y: ["x"] },
    });
    const tree = buildDependencyTree(cyclic);
    const x = tree.find((n) => n.fullName === "x")!;
    expect(x.children.map((c) => c.fullName)).toEqual(["y"]);
    // y's child x is dropped (already visited) so the recursion terminates.
    expect(x.children[0].children).toEqual([]);
  });

  it("filters to matching branches when a query is given", () => {
    const tree = buildDependencyTree(report(graph), "d");
    // All roots that contain "d" stay; "b" (no match) is dropped.
    expect(tree.map((n) => n.fullName)).toEqual(["a", "c", "d"]);
    expect(tree.find((n) => n.fullName === "b")).toBeUndefined();
    const a = tree.find((n) => n.fullName === "a")!;
    expect(a.children[0].fullName).toBe("c");
    expect(a.children[0].children[0].fullName).toBe("d");
  });
});
