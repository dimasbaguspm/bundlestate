import type { BundleStateReport } from "@/lib/types";

/** Minimal but realistic report for tests — mirrors store.test.ts shape. */
export function makeReport(id: string, sourceName = "demo.zip"): BundleStateReport {
  return {
    id,
    sourceName,
    generatedAt: new Date().toISOString(),
    assets: [{ name: "a.js", sizeBytes: 100, gzipBytes: 40, usedModules: ["react"] }],
    packages: [
      {
        name: "react",
        fullName: "react",
        version: "18.3.1",
        source: "webpack",
        usedIn: ["a.js"],
      },
    ],
    declaredDeps: { dependencies: { react: "^18.0.0" }, devDependencies: {}, peerDependencies: {} },
    lockfile: { format: "pnpm", packageCount: 1, rawName: "pnpm-lock.yaml" },
    graph: {
      appToPkg: { "my-app": ["react"] },
      pkgToSubPkg: { react: [] },
    },
    moduleGraph: {
      nodes: [
        { id: "src/index.ts", local: true },
        { id: "src/utils.ts", local: true },
        { id: "node_modules/react/index.js", pkg: "react", local: false },
      ],
      edges: [
        ["src/index.ts", "src/utils.ts"],
        ["src/index.ts", "node_modules/react/index.js"],
      ],
      pkgModules: { react: ["node_modules/react/index.js"] },
      hasContents: true,
    },
    insights: {
      unusedDeclaredDeps: [],
      gzipRatio: 0.4,
      largestAssets: ["a.js"],
      totalSizeBytes: 100,
      totalGzipBytes: 40,
      versionClashes: [],
      circularDepGroups: [],
      circularDepCount: 0,
      lineage: { available: true, nodes: 3, edges: 2 },
    },
  };
}