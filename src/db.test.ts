import { beforeEach, describe, expect, it } from "vitest";
import {
  clearReports,
  deleteReport,
  listReports,
  loadReport,
  saveReport,
} from "./db";
import type { BundleStateReport } from "@/lib/types";

function makeReport(id: string, sourceName = "demo.zip"): BundleStateReport {
  return {
    id,
    sourceName,
    generatedAt: new Date().toISOString(),
    assets: [{ name: "a.js", sizeBytes: 10, gzipBytes: 4, usedModules: ["react"] }],
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
    graph: { appToPkg: { app: ["react"] }, pkgToSubPkg: { react: [] } },
    moduleGraph: {
      nodes: [
        { id: "src/index.ts", local: true },
        { id: "node_modules/react/index.js", pkg: "react", local: false },
      ],
      edges: [["node_modules/react/index.js", "src/index.ts"]],
      pkgModules: { react: ["node_modules/react/index.js"] },
      hasContents: true,
    },
    insights: {
      unusedDeclaredDeps: [],
      gzipRatio: 0.4,
      largestAssets: ["a.js"],
      totalSizeBytes: 10,
      totalGzipBytes: 4,
      versionClashes: [],
      circularDepGroups: [],
      circularDepCount: 0,
      lineage: { available: true, nodes: 2, edges: 1 },
    },
  };
}

describe("bundlestate-db", () => {
  beforeEach(async () => {
    await clearReports();
  });

  it("round-trips a full report including nested module graph", async () => {
    const report = makeReport("r-1");
    await saveReport(report);

    const loaded = await loadReport("r-1");
    expect(loaded).toEqual(report);
    expect(loaded?.moduleGraph?.pkgModules.react).toEqual([
      "node_modules/react/index.js",
    ]);
  });

  it("returns undefined for a missing report", async () => {
    expect(await loadReport("nope")).toBeUndefined();
  });

  it("deletes a single report", async () => {
    await saveReport(makeReport("r-1"));
    await saveReport(makeReport("r-2"));
    await deleteReport("r-1");

    expect(await loadReport("r-1")).toBeUndefined();
    expect(await loadReport("r-2")).not.toBeUndefined();
  });

  it("clears all stored reports", async () => {
    await saveReport(makeReport("r-1"));
    await clearReports();
    expect(await loadReport("r-1")).toBeUndefined();
  });

  it("lists report metadata newest first", async () => {
    await saveReport(makeReport("r-old", "old.zip"));
    const fresh = makeReport("r-new", "new.zip");
    fresh.generatedAt = new Date(Date.now() + 1000).toISOString();
    await saveReport(fresh);

    const rows = await listReports();
    expect(rows.map((r) => r.id)).toEqual(["r-new", "r-old"]);
    expect(rows[0]).toEqual({ id: "r-new", sourceName: "new.zip", generatedAt: fresh.generatedAt });
  });
});