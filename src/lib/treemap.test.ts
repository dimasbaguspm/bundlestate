import { describe, expect, it } from "vitest";
import { buildTreemapData, layoutTreemap } from "./treemap";
import type { BundleStateReport } from "./types";

function report(): BundleStateReport {
  return {
    id: "r",
    sourceName: "app.zip",
    generatedAt: new Date().toISOString(),
    assets: [
      { name: "a.js", sizeBytes: 100, gzipBytes: 40, usedModules: ["react", "lodash"] },
      { name: "b.js", sizeBytes: 50, gzipBytes: 20, usedModules: ["react"] },
    ],
    packages: [],
    declaredDeps: { dependencies: {}, devDependencies: {}, peerDependencies: {} },
    lockfile: { format: "none", packageCount: 0, rawName: "" },
    graph: { appToPkg: {}, pkgToSubPkg: {} },
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

describe("layoutTreemap", () => {
  it("produces package leaves plus asset frames within the given size", () => {
    const rects = layoutTreemap(report(), 400, 300);
    const leaves = rects.filter((r) => r.isPackage);
    // react ships in both assets, so it yields two leaves; lodash only in a.js.
    expect(leaves.map((l) => l.name).sort()).toEqual(["lodash", "react", "react"]);
    // Asset frames (non-package) are included so the grouping is visible.
    expect(rects.filter((r) => !r.isPackage).length).toBeGreaterThan(0);
    // Every rect stays inside the canvas.
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(400);
      expect(r.y + r.height).toBeLessThanOrEqual(300);
    }
  });

  it("react occupies more area than lodash (100/2 + 50 vs 100/2)", () => {
    const leaves = layoutTreemap(report(), 600, 400).filter((r) => r.isPackage);
    const react = leaves.filter((l) => l.name === "react").reduce((s, l) => s + l.width * l.height, 0);
    const lodash = leaves.find((l) => l.name === "lodash")!;
    expect(react).toBeGreaterThan(lodash.width * lodash.height);
  });

  it("filters leaves by query and drops assets with no match", () => {
    const rects = layoutTreemap(report(), 200, 100, "lodash");
    expect(rects.filter((r) => r.isPackage).map((l) => l.name)).toEqual(["lodash"]);
  });

  it("returns [] for a non-positive size", () => {
    expect(layoutTreemap(report(), 0, 100)).toEqual([]);
  });
});

describe("buildTreemapData", () => {
  it("groups assets under the report name", () => {
    const data = buildTreemapData(report());
    expect(data.name).toBe("app.zip");
    expect(data.children!.length).toBe(2);
  });
});
