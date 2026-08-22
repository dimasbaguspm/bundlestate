import { describe, expect, it } from "vitest";
import { simulateExclusions } from "./whatif";
import { diffReports } from "./diff";
import type { BundleStateReport } from "./types";

function makeReport(over: Partial<BundleStateReport> = {}): BundleStateReport {
  const base: BundleStateReport = {
    id: "r1",
    sourceName: "app.zip",
    generatedAt: "2026-08-22T00:00:00.000Z",
    assets: [
      { name: "a.js", sizeBytes: 100, gzipBytes: 40, usedModules: ["react", "lodash"], rawBytes: "", kind: "js" },
      { name: "b.js", sizeBytes: 100, gzipBytes: 40, usedModules: ["react"], rawBytes: "", kind: "js" },
    ],
    packages: [
      { name: "react", fullName: "react", source: "pnpm", usedIn: ["a.js", "b.js"] },
      { name: "lodash", fullName: "lodash", source: "pnpm", usedIn: ["a.js"] },
    ],
    declaredDeps: { dependencies: {}, devDependencies: {}, peerDependencies: {} },
    lockfile: { format: "pnpm", packageCount: 2, rawName: "pnpm-lock.yaml" },
    graph: { appToPkg: {}, pkgToSubPkg: {} },
    insights: {
      unusedDeclaredDeps: [],
      gzipRatio: 0.4,
      largestAssets: ["a.js"],
      totalSizeBytes: 200,
      totalGzipBytes: 80,
      versionClashes: [],
      circularDepGroups: [],
      circularDepCount: 0,
      lineage: { available: false, nodes: 0, edges: 0 },
    },
  };
  return { ...base, ...over };
}

describe("simulateExclusions (PRD §4.5.1)", () => {
  it("keeps everything when nothing excluded", () => {
    const r = simulateExclusions(makeReport(), new Set());
    expect(r.totalRaw).toBe(200);
    expect(r.savedRaw).toBe(0);
    expect(r.packageSizes).toHaveLength(2);
  });

  it("drops a package's share when excluded", () => {
    // lodash only appears in a.js (100 bytes / 2 modules = 50 bytes share)
    const r = simulateExclusions(makeReport(), new Set(["lodash"]));
    expect(r.totalRaw).toBeLessThan(200);
    expect(r.savedRaw).toBeGreaterThan(0);
    expect(r.packageSizes.find((p) => p.fullName === "lodash")).toBeUndefined();
  });

  it("removes all bytes only when every module of an asset is excluded", () => {
    // excluding react removes its share from both assets (all have react)
    const r = simulateExclusions(makeReport(), new Set(["react"]));
    expect(r.totalRaw).toBeLessThan(150);
    expect(r.savedPct).toBeGreaterThan(0);
  });
});

describe("diffReports (PRD §4.5.2)", () => {
  const base = makeReport({ id: "base", sourceName: "main.zip" });
  const other = makeReport({
    id: "other",
    sourceName: "feature.zip",
    assets: [
      { name: "a.js", sizeBytes: 150, gzipBytes: 60, usedModules: ["react", "lodash"], rawBytes: "", kind: "js" },
      { name: "b.js", sizeBytes: 100, gzipBytes: 40, usedModules: ["react"], rawBytes: "", kind: "js" },
      { name: "c.js", sizeBytes: 50, gzipBytes: 20, usedModules: ["moment"], rawBytes: "", kind: "js" },
    ],
    packages: [
      { name: "react", fullName: "react", source: "pnpm", usedIn: ["a.js", "b.js"] },
      { name: "lodash", fullName: "lodash", source: "pnpm", usedIn: ["a.js"] },
      { name: "moment", fullName: "moment", source: "pnpm", usedIn: ["c.js"] },
    ],
  });

  const d = diffReports(base, other);

  it("reports raw + gzip deltas", () => {
    expect(d.totalRawDelta).toBe(100); // 300 - 200
    expect(d.totalGzipDelta).toBe(40); // 120 - 80
  });

  it("flags added and removed packages", () => {
    expect(d.addedCount).toBe(1); // moment
    expect(d.removedCount).toBe(0);
    expect(d.packages.find((p) => p.fullName === "moment")?.status).toBe("added");
  });

  it("detects newly introduced cycles", () => {
    const withCycle = makeReport({
      id: "cyc",
      insights: {
        unusedDeclaredDeps: [], gzipRatio: 0.4, largestAssets: [], totalSizeBytes: 200,
        totalGzipBytes: 80, versionClashes: [], circularDepGroups: [["x.ts", "y.ts"]],
        circularDepCount: 1, lineage: { available: false, nodes: 0, edges: 0 },
      },
    });
    const dd = diffReports(base, withCycle);
    expect(dd.newCycles).toHaveLength(1);
    expect(dd.resolvedCycles).toHaveLength(0);
  });
});
