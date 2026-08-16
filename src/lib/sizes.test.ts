import { describe, expect, it } from "vitest";
import { buildPackageSizes } from "./sizes";
import type { BundleStateReport } from "./types";

function report(): BundleStateReport {
  return {
    id: "r",
    sourceName: "app.zip",
    generatedAt: new Date().toISOString(),
    assets: [
      { name: "a.js", sizeBytes: 100, gzipBytes: 40, usedModules: ["react", "lodash"] },
      { name: "b.js", sizeBytes: 20, gzipBytes: 10, usedModules: ["lodash"] },
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

describe("buildPackageSizes", () => {
  it("aggregates each package's per-asset share and sorts descending", () => {
    const sizes = buildPackageSizes(report());
    // react: 100/2 = 50. lodash: 100/2 + 20 = 70.
    expect(sizes).toEqual([
      { fullName: "lodash", sizeBytes: 70 },
      { fullName: "react", sizeBytes: 50 },
    ]);
  });
});
