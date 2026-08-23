import { describe, expect, it } from "vitest";
import {
  displayModuleId,
  formatLineageChain,
  latestBadge,
  moduleDegrees,
  type ModuleIdMap,
} from "./inspector";
import type { ModuleGraph, ModuleNode } from "@/lib/types";

const byId: ModuleIdMap = new Map<string, ModuleNode>([
  ["src/pages/Dashboard.tsx", { id: "src/pages/Dashboard.tsx", local: true }],
  [
    "node_modules/react-chartjs-2/index.js",
    { id: "node_modules/react-chartjs-2/index.js", pkg: "react-chartjs-2", local: false },
  ],
  [
    "node_modules/chart.js/dist/chart.js",
    { id: "node_modules/chart.js/dist/chart.js", pkg: "chart.js", local: false },
  ],
  [
    "node_modules/moment/moment.js",
    { id: "node_modules/moment/moment.js", pkg: "moment", local: false },
  ],
]);

describe("latestBadge", () => {
  it("reports an update when local and latest differ", () => {
    expect(latestBadge("18.3.1", "19.0.0")).toEqual({
      label: "→ 19.0.0 available",
      tone: "accent",
    });
  });

  it("reports up to date when versions match", () => {
    expect(latestBadge("18.3.1", "18.3.1")).toEqual({ label: "up to date", tone: "ok" });
  });

  it("returns null when the local version is unknown", () => {
    expect(latestBadge(undefined, "19.0.0")).toBeNull();
  });

  it("returns null while the latest version is still unknown", () => {
    expect(latestBadge("18.3.1", undefined)).toBeNull();
  });
});

describe("displayModuleId / formatLineageChain", () => {
  it("shows package names for node_modules modules and full paths for local ones", () => {
    expect(displayModuleId("node_modules/chart.js/dist/chart.js", byId)).toBe("chart.js");
    expect(displayModuleId("src/pages/Dashboard.tsx", byId)).toBe("src/pages/Dashboard.tsx");
    // Unresolvable node_modules path falls back to a short path fragment.
    expect(displayModuleId("node_modules/x/y/z.js", byId)).toBe("x/y/z.js");
  });

  it("formats a chain with package names and arrows", () => {
    const chain = [
      "src/pages/Dashboard.tsx",
      "node_modules/react-chartjs-2/index.js",
      "node_modules/chart.js/dist/chart.js",
      "node_modules/moment/moment.js",
    ];
    expect(formatLineageChain(chain, byId)).toEqual([
      "src/pages/Dashboard.tsx",
      "react-chartjs-2",
      "chart.js",
      "moment",
    ]);
  });
});

describe("moduleDegrees", () => {
  const graph: ModuleGraph = {
    nodes: [
      { id: "a", local: true },
      { id: "b", local: true },
      { id: "c", local: true },
    ],
    edges: [
      ["a", "b"],
      ["c", "b"],
      ["b", "c"],
    ],
    pkgModules: {},
    hasContents: true,
  };

  it("counts importers and imports of a module", () => {
    expect(moduleDegrees(graph, "b")).toEqual({ importedBy: 2, imports: 1 });
    expect(moduleDegrees(graph, "c")).toEqual({ importedBy: 1, imports: 1 });
    expect(moduleDegrees(graph, "unknown")).toEqual({ importedBy: 0, imports: 0 });
  });
});