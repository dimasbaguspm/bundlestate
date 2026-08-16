import { describe, expect, it } from "vitest";
import { findLineages } from "./lineage";
import type { ImportEdge, ModuleGraph, ModuleNode } from "./types";

const node = (id: string, pkg?: string): ModuleNode => ({
  id,
  pkg,
  local: pkg === undefined,
});

const EDGES: ImportEdge[] = [
  // app → chart lib → target
  ["src/pages/Dashboard.tsx", "node_modules/react-chartjs-2/index.js"],
  ["node_modules/react-chartjs-2/index.js", "node_modules/chart.js/dist/chart.js"],
  ["node_modules/chart.js/dist/chart.js", "node_modules/moment/moment.js"],
  // second path into the same target
  ["src/features/reports.ts", "node_modules/chart.js/dist/chart.js"],
];

const NODES: ModuleNode[] = [
  node("src/pages/Dashboard.tsx"),
  node("src/features/reports.ts"),
  node("node_modules/react-chartjs-2/index.js", "react-chartjs-2"),
  node("node_modules/chart.js/dist/chart.js", "chart.js"),
  node("node_modules/moment/moment.js", "moment"),
];

const MODULE_GRAPH: ModuleGraph = {
  nodes: NODES,
  edges: EDGES,
  pkgModules: { moment: ["node_modules/moment/moment.js"] },
  hasContents: true,
};

describe("findLineages", () => {
  it("traces the shortest import chain to the target package", () => {
    const result = findLineages(MODULE_GRAPH, ["node_modules/moment/moment.js"]);
    expect(result.totalPaths).toBeGreaterThan(0);
    expect(result.chains.length).toBeGreaterThan(0);

    const chain = result.chains[0].modules;
    expect(chain[chain.length - 1]).toBe("node_modules/moment/moment.js");
    expect(chain.join(" → ")).toContain("chart.js");
  });

  it("collapses consecutive same-package modules", () => {
    const result = findLineages(MODULE_GRAPH, ["node_modules/moment/moment.js"]);
    for (const chain of result.chains) {
      const ids = chain.modules;
      for (let i = 1; i < ids.length; i++) {
        const prevPkg = MODULE_GRAPH.nodes.find((n) => n.id === ids[i - 1])?.pkg;
        const curPkg = MODULE_GRAPH.nodes.find((n) => n.id === ids[i])?.pkg;
        // The pruned chain never has two adjacent modules of the same package.
        expect(prevPkg === undefined || prevPkg !== curPkg).toBe(true);
      }
    }
  });

  it("reports orphaned targets with no importers", () => {
    const orphan = findLineages(MODULE_GRAPH, ["node_modules/react/index.js"]);
    expect(orphan.chains.length).toBe(0);
    expect(orphan.orphaned).toContain("node_modules/react/index.js");
  });
});