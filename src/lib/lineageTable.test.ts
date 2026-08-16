import { describe, expect, it } from "vitest";
import { buildLineageTable } from "./lineageTable";
import type { BundleStateReport, ModuleGraph } from "./types";

function reportWith(edges: ModuleGraph["edges"]): BundleStateReport {
  const pkgs = ["foo", "bar", "baz"];
  const modId = (pkg: string) => `node_modules/.pnpm/${pkg}@1.0.0/node_modules/${pkg}/index.js`;
  const moduleGraph: ModuleGraph = {
    nodes: [
      ...pkgs.map((p) => ({ id: modId(p), pkg: p, local: false })),
      { id: "src/index.ts", local: true },
    ],
    edges,
    pkgModules: Object.fromEntries(pkgs.map((p) => [p, [modId(p)]])),
    hasContents: true,
  };
  return {
    id: "r",
    sourceName: "app.zip",
    generatedAt: new Date().toISOString(),
    assets: [],
    packages: pkgs.map((p) => ({ name: p, fullName: p, version: "1.0.0", source: "pnpm", usedIn: [] })),
    declaredDeps: { dependencies: {}, devDependencies: {}, peerDependencies: {} },
    lockfile: { format: "pnpm", packageCount: 0, rawName: "pnpm-lock.yaml" },
    graph: { appToPkg: {}, pkgToSubPkg: {} },
    moduleGraph,
    insights: {
      unusedDeclaredDeps: [],
      gzipRatio: null,
      largestAssets: [],
      totalSizeBytes: 0,
      totalGzipBytes: null,
      versionClashes: [],
      circularDepGroups: [],
      circularDepCount: 0,
      lineage: { available: true, nodes: 0, edges: 0 },
    },
  };
}

describe("buildLineageTable", () => {
  // app -> foo -> bar -> baz
  const report = reportWith([
    ["src/index.ts", "node_modules/.pnpm/foo@1.0.0/node_modules/foo/index.js"],
    ["node_modules/.pnpm/foo@1.0.0/node_modules/foo/index.js", "node_modules/.pnpm/bar@1.0.0/node_modules/bar/index.js"],
    ["node_modules/.pnpm/bar@1.0.0/node_modules/bar/index.js", "node_modules/.pnpm/baz@1.0.0/node_modules/baz/index.js"],
  ]);

  it("lists packages sorted by transitive dependant count", () => {
    const rows = buildLineageTable(report);
    expect(rows.map((r) => r.fullName)).toEqual(["baz", "bar", "foo"]);
    expect(rows.map((r) => r.usedByCount)).toEqual([3, 2, 1]);
  });

  it("shows the expandable dependant chain up to app", () => {
    const rows = buildLineageTable(report);
    // baz: bar -> foo -> app
    const baz = rows.find((r) => r.fullName === "baz")!;
    expect(baz.children.map((c) => c.fullName)).toEqual(["bar"]);
    expect(baz.children[0].children.map((c) => c.fullName)).toEqual(["foo"]);
    expect(baz.children[0].children[0].children.map((c) => c.fullName)).toEqual(["app"]);
    expect(baz.children[0].children[0].children[0].isApp).toBe(true);
    // foo: app
    const foo = rows.find((r) => r.fullName === "foo")!;
    expect(foo.children.map((c) => c.fullName)).toEqual(["app"]);
  });

  it("filters rows by package name", () => {
    const rows = buildLineageTable(report, "ba");
    expect(rows.map((r) => r.fullName)).toEqual(["baz", "bar"]);
  });
});
