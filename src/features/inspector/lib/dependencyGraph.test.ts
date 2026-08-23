import { describe, expect, it } from "vitest";
import { buildPackageGraph } from "./dependencyGraph";
import type { BundleStateReport, ModuleGraph } from "@/lib/types";

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

  it("shows a package that ships multiple versions as separate nodes", () => {
    const moduleGraph: ModuleGraph = {
      nodes: [
        { id: "node_modules/.pnpm/foo@1.0.0/node_modules/foo/index.js", pkg: "foo", version: "1.0.0", local: false },
        { id: "node_modules/.pnpm/foo@2.0.0/node_modules/foo/index.js", pkg: "foo", version: "2.0.0", local: false },
        { id: "src/index.ts", local: true },
      ],
      edges: [
        ["src/index.ts", "node_modules/.pnpm/foo@1.0.0/node_modules/foo/index.js"],
        ["src/index.ts", "node_modules/.pnpm/foo@2.0.0/node_modules/foo/index.js"],
      ],
      pkgModules: {
        foo: [
          "node_modules/.pnpm/foo@1.0.0/node_modules/foo/index.js",
          "node_modules/.pnpm/foo@2.0.0/node_modules/foo/index.js",
        ],
      },
      hasContents: true,
    };
    const report = makeReport({
      packages: [
        { name: "foo", fullName: "foo", version: "1.0.0", source: "pnpm", usedIn: [] },
        { name: "foo", fullName: "foo", version: "2.0.0", source: "pnpm", usedIn: [] },
      ],
      moduleGraph,
    });

    const data = buildPackageGraph(report);

    const ids = data.nodes.map((n) => n.id);
    expect(ids).toContain("foo@1.0.0");
    expect(ids).toContain("foo@2.0.0");
    expect(ids).not.toContain("foo");
    // Each version keeps its own edge from the app source.
    expect(data.edges.some((e) => e.source === "app" && e.target === "foo@1.0.0")).toBe(true);
    expect(data.edges.some((e) => e.source === "app" && e.target === "foo@2.0.0")).toBe(true);
    // Node carries the plain name + version so the inspector can resolve it.
    const node = data.nodes.find((n) => n.id === "foo@1.0.0")!;
    expect(node.fullName).toBe("foo");
    expect(node.version).toBe("1.0.0");
  });
});