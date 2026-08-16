import { describe, expect, it } from "vitest";
import { buildModuleSubgraph, buildPackageGraph } from "./dependencyGraph";
import type { BundleStateReport, ModuleGraph } from "./types";

const moduleGraph = (edges: ModuleGraph["edges"], pkgModules: ModuleGraph["pkgModules"]): ModuleGraph => ({
  nodes: [
    ...Object.entries(pkgModules).flatMap(([pkg, mods]) =>
      mods.map((id) => ({ id, pkg, local: false })),
    ),
    { id: "src/index.ts", local: true },
  ],
  edges,
  pkgModules,
  hasContents: true,
});

function makeReport(overrides: Partial<BundleStateReport> = {}): BundleStateReport {
  return {
    id: "r1",
    sourceName: "bundle.zip",
    generatedAt: new Date().toISOString(),
    assets: [],
    packages: [
      { name: "react", fullName: "react", version: "18.3.1", source: "webpack", usedIn: [] },
      { name: "moment", fullName: "moment", version: "2.29.4", source: "webpack", usedIn: [] },
      { name: "lodash", fullName: "lodash", version: "4.17.21", source: "webpack", usedIn: [] },
    ],
    declaredDeps: { dependencies: {}, devDependencies: {}, peerDependencies: {} },
    lockfile: { format: "none", packageCount: 0, rawName: "" },
    graph: { appToPkg: {}, pkgToSubPkg: {} },
    moduleGraph: moduleGraph([], {}),
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
    ...overrides,
  };
}

describe("buildPackageGraph", () => {
  it("aggregates module edges into weighted package edges with an app node", () => {
    const report = makeReport({
      moduleGraph: moduleGraph(
        [
          ["src/index.ts", "node_modules/react/index.js"],
          ["src/index.ts", "node_modules/lodash/lodash.js"],
          ["node_modules/react/index.js", "node_modules/moment/moment.js"],
        ],
        {
          react: ["node_modules/react/index.js"],
          moment: ["node_modules/moment/moment.js"],
          lodash: ["node_modules/lodash/lodash.js"],
        },
      ),
    });

    const data = buildPackageGraph(report);

    expect(data.hasModuleData).toBe(true);
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    expect(byId.get("app")?.name).toBe("app source");
    expect(byId.get("app")?.category).toBe("app");

    const edge = (s: string, t: string) =>
      data.edges.find((e) => e.source === s && e.target === t);

    // Local module → react counts as app → react.
    expect(edge("app", "react")?.weight).toBe(1);
    expect(edge("app", "lodash")?.weight).toBe(1);
    // Both local modules importing the same package aggregate into weight 2.
    expect(edge("app", "react")).toBeDefined();
    expect(edge("react", "moment")?.weight).toBe(1);

    // Symbol weight = incident edge count.
    expect(byId.get("react")?.value).toBe(2);
    expect(byId.get("moment")?.value).toBe(1);
  });

  it("skips module edges inside the same package", () => {
    const report = makeReport({
      moduleGraph: moduleGraph(
        [
          ["node_modules/react/index.js", "node_modules/react/cjs/react.js"],
        ],
        { react: ["node_modules/react/index.js", "node_modules/react/cjs/react.js"] },
      ),
    });

    const data = buildPackageGraph(report);
    expect(data.edges.some((e) => e.source === "react" && e.target === "react")).toBe(false);
    // The package is still listed as a node.
    expect(data.nodes.map((n) => n.id)).toContain("react");
  });

  it("falls back to lockfile pkgToSubPkg edges when no module graph exists", () => {
    const report = makeReport({
      moduleGraph: undefined,
      graph: {
        appToPkg: { app: [] },
        pkgToSubPkg: {
          react: ["scheduler"],
          lodash: [],
        },
      },
    });

    const data = buildPackageGraph(report);

    expect(data.hasModuleData).toBe(false);
    expect(data.nodes.some((n) => n.category === "app")).toBe(false);
    expect(data.edges).toEqual([
      { source: "react", target: "scheduler", weight: 1 },
    ]);
    // Lockfile-only target becomes a package node so the edge is not dangling.
    expect(data.nodes.map((n) => n.id)).toContain("scheduler");
  });
});

describe("buildModuleSubgraph", () => {
  it("shows a package's modules plus their direct neighbours", () => {
    const report = makeReport({
      moduleGraph: moduleGraph(
        [
          ["node_modules/react/index.js", "node_modules/react/cjs/react.js"],
          ["node_modules/react/index.js", "node_modules/moment/moment.js"],
          ["src/index.ts", "node_modules/react/index.js"],
        ],
        {
          react: ["node_modules/react/index.js", "node_modules/react/cjs/react.js"],
          moment: ["node_modules/moment/moment.js"],
        },
      ),
    });

    const sub = buildModuleSubgraph(report, "react");

    const ids = sub!.nodes.map((n) => n.id).sort();
    expect(ids).toEqual([
      "node_modules/moment/moment.js",
      "node_modules/react/cjs/react.js",
      "node_modules/react/index.js",
      "src/index.ts",
    ]);
    const edges = sub!.edges.map((e) => `${e.source}→${e.target}`).sort();
    expect(edges).toEqual(
      [
        "node_modules/react/index.js→node_modules/react/cjs/react.js",
        "node_modules/react/index.js→node_modules/moment/moment.js",
        "src/index.ts→node_modules/react/index.js",
      ].sort(),
    );
    const entry = sub!.nodes.find((n) => n.id === "node_modules/react/index.js")!;
    expect(entry.pkg).toBe("react");
    expect(entry.category).toBe("module");
    // The busy hub ranks highest (3 incident module edges).
    expect(entry.value).toBe(3);
  });

  it("returns null when the module graph is unavailable", () => {
    const report = makeReport({ moduleGraph: undefined });
    expect(buildModuleSubgraph(report, "react")).toBeNull();
  });

  it("returns null for an unknown package", () => {
    const report = makeReport();
    expect(buildModuleSubgraph(report, "not-shipped")).toBeNull();
  });
});