import { beforeEach, describe, expect, it } from "vitest";
import { useBundleStore } from "./store";
import type { BundleStateReport } from "@/lib/types";

function makeReport(id: string): BundleStateReport {
  return {
    id,
    sourceName: "demo.zip",
    generatedAt: new Date().toISOString(),
    assets: [],
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
      lineage: { available: false, nodes: 0, edges: 0, reason: "no maps" },
    },
  };
}

describe("bundle store", () => {
  beforeEach(() => {
    useBundleStore.setState({ jobs: {}, reports: {} });
  });

  it("adds jobs and updates their progress", () => {
    const id = useBundleStore.getState().addJob("bundle.zip");
    expect(useBundleStore.getState().jobs[id]).toMatchObject({
      sourceName: "bundle.zip",
      status: "pending",
      progress: 0,
    });

    useBundleStore.getState().updateJob(id, { status: "extracting", progress: 0.4 });
    expect(useBundleStore.getState().jobs[id].progress).toBe(0.4);
    expect(useBundleStore.getState().jobs[id].status).toBe("extracting");
  });

  it("holds reports and links them to finished jobs", () => {
    const id = useBundleStore.getState().addJob("demo.zip");
    const report = makeReport("report-1");
    useBundleStore.getState().addReport(report);
    useBundleStore.getState().updateJob(id, { status: "done", reportId: report.id });

    expect(useBundleStore.getState().reports["report-1"]).toBe(report);
    expect(useBundleStore.getState().jobs[id].reportId).toBe("report-1");
  });

  it("removes reports and clears all state", () => {
    useBundleStore.getState().addReport(makeReport("report-1"));
    useBundleStore.getState().removeReport("report-1");
    expect(useBundleStore.getState().reports).toEqual({});

    useBundleStore.getState().addReport(makeReport("report-2"));
    useBundleStore.getState().clearAll();
    expect(useBundleStore.getState().reports).toEqual({});
    expect(useBundleStore.getState().jobs).toEqual({});
  });
});
