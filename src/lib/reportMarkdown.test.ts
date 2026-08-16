import { describe, expect, it } from "vitest";
import { buildMarkdownReport } from "./reportMarkdown";
import type { BundleStateReport } from "./types";

function report(): BundleStateReport {
  return {
    id: "r",
    sourceName: "app.zip",
    generatedAt: new Date().toISOString(),
    assets: [{ name: "a.js", sizeBytes: 100, gzipBytes: 40, usedModules: ["react", "lodash"] }],
    packages: [
      { name: "react", fullName: "react", version: "19.0.0", source: "pnpm", usedIn: ["a.js"] },
      { name: "lodash", fullName: "lodash", version: "4.17.21", source: "pnpm", usedIn: ["a.js"] },
    ],
    declaredDeps: { dependencies: { react: "^19", lodash: "^4" }, devDependencies: {}, peerDependencies: {} },
    lockfile: { format: "pnpm", packageCount: 2, rawName: "pnpm-lock.yaml" },
    graph: { appToPkg: { app: ["react"] }, pkgToSubPkg: {} },
    insights: {
      unusedDeclaredDeps: ["moment"],
      gzipRatio: 0.4,
      largestAssets: ["a.js"],
      totalSizeBytes: 100,
      totalGzipBytes: 40,
      versionClashes: [{ fullName: "uuid", versions: [{ version: "3.4.0", importedBy: ["react"] }] }],
      circularDepGroups: [],
      circularDepCount: 0,
      lineage: { available: false, nodes: 0, edges: 0 },
    },
  };
}

describe("buildMarkdownReport", () => {
  it("produces a PR-ready markdown summary with totals, largest packages and flags", () => {
    const md = buildMarkdownReport(report());
    expect(md).toContain("## Bundle report · app.zip");
    expect(md).toContain("**Total size:** 100 B (40 B gzip)");
    expect(md).toContain("**Assets:** 1 · **Packages:** 2");
    expect(md).toContain("**Gzip ratio:** 40.0%");
    expect(md).toContain("| Package | Size |");
    expect(md).toContain("| `lodash` | 50 B |");
    expect(md).toContain("**uuid** ships `3.4.0`");
    expect(md).toContain("- `moment`");
  });

  it("omits empty sections", () => {
    const r = report();
    r.insights.versionClashes = [];
    r.insights.unusedDeclaredDeps = [];
    const md = buildMarkdownReport(r);
    expect(md).not.toContain("Duplicate packages");
    expect(md).not.toContain("Unused declared deps");
  });
});
