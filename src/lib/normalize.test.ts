import { describe, expect, it } from "vitest";
import { gzipSize, normalizeBundle, type NormalizeInput } from "./normalize";

const text = (s: string) => new TextEncoder().encode(s);

const PACKAGE_JSON = JSON.stringify({
  name: "demo-app",
  dependencies: { react: "^18.3.1", "unused-dep": "^1.0.0" },
});

const PNPM_LOCK = `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      react:
        specifier: ^18.3.1
        version: 18.3.1

packages:
  react@18.3.1:
    resolution: {integrity: sha512-abc}
  react-dom@18.3.1:
    resolution: {integrity: sha512-def}
    dependencies:
      react: 18.3.1
`;

function makeInput(): NormalizeInput {
  const source = "webpack:///./node_modules/react/index.js";
  return {
    sourceName: "demo.zip",
    assets: [
      {
        name: "dist/main.js",
        sizeBytes: 4096,
        bytes: text('console.log("compressible-content-'.repeat(256) + '");'),
        mapSources: [
          source,
          "webpack:///./node_modules/react-dom/index.js",
          "webpack:///./src/App.tsx",
        ],
      },
    ],
    entries: [
      { name: "dist/main.js", sizeBytes: 4096, bytes: new Uint8Array(4096) },
      { name: "package.json", sizeBytes: 0, bytes: text(PACKAGE_JSON) },
      { name: "pnpm-lock.yaml", sizeBytes: 0, bytes: text(PNPM_LOCK) },
    ],
  };
}

describe("gzipSize", () => {
  it("computes the gzip size of bytes via CompressionStream", async () => {
    const bytes = text("hello hello hello hello hello hello");
    const size = await gzipSize(bytes);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(bytes.length);
  });
});

describe("normalizeBundle", () => {
  it("produces a BundleStateReport with assets, packages, deps, graph and insights", async () => {
    const report = await normalizeBundle(makeInput());

    expect(report.sourceName).toBe("demo.zip");
    expect(typeof report.id).toBe("string");
    expect(report.id.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false);

    // assets: usedModules resolved from map sources, app code filtered
    expect(report.assets).toHaveLength(1);
    const asset = report.assets[0];
    expect(asset.name).toBe("dist/main.js");
    expect(asset.usedModules).toEqual(["react", "react-dom"]);
    expect(asset.sizeBytes).toBe(4096);
    expect(asset.gzipBytes).not.toBeNull();
    expect(asset.gzipBytes!).toBeLessThan(asset.sizeBytes);

    // packages aggregated with usedIn
    expect(report.packages.map((p) => p.fullName).sort()).toEqual(["react", "react-dom"]);
    const react = report.packages.find((p) => p.fullName === "react")!;
    expect(react.usedIn).toEqual(["dist/main.js"]);
    expect(report.packages.find((p) => p.fullName === "react-dom")!.version).toBe("18.3.1");

    // declared deps from root package.json
    expect(report.declaredDeps.dependencies).toEqual({
      react: "^18.3.1",
      "unused-dep": "^1.0.0",
    });

    // lockfile + graph
    expect(report.lockfile.format).toBe("pnpm");
    expect(report.graph.pkgToSubPkg["react-dom"]).toEqual(["react"]);
    expect(report.graph.appToPkg["demo-app"]).toContain("react");

    // insights flag the declared-but-unshiped dep
    expect(report.insights.unusedDeclaredDeps).toContain("unused-dep");
  });

  it("tolerates missing maps, lockfile and package.json", async () => {
    const report = await normalizeBundle({
      sourceName: "bare.zip",
      assets: [],
      entries: [{ name: "readme.md", sizeBytes: 3, bytes: text("hey") }],
    });

    expect(report.assets).toEqual([]);
    expect(report.packages).toEqual([]);
    expect(report.declaredDeps.dependencies).toEqual({});
    expect(report.lockfile.format).toBe("none");
    expect(report.graph.appToPkg).toEqual({});
  });
});
