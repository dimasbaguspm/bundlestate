import { describe, expect, it } from "vitest";
import { findCircularGroups, traceCycle } from "./cycles";
import type { ImportEdge } from "./types";

describe("traceCycle (PRD §4.4.2)", () => {
  const edges: ImportEdge[] = [
    ["a.ts", "b.ts"],
    ["b.ts", "c.ts"],
    ["c.ts", "a.ts"],
  ];

  it("walks a simple ring into a closed path A→B→C→A", () => {
    const path = traceCycle(["a.ts", "b.ts", "c.ts"], edges);
    expect(path[0]).toBe("a.ts");
    expect(path[path.length - 1]).toBe("a.ts"); // closes
    expect(path).toEqual(["a.ts", "b.ts", "c.ts", "a.ts"]);
  });

  it("still closes the loop when group order differs from edge order", () => {
    const path = traceCycle(["c.ts", "a.ts", "b.ts"], edges);
    expect(path[0]).toBe("c.ts");
    expect(path[path.length - 1]).toBe("c.ts");
  });

  it("handles a 2-node cycle", () => {
    const e: ImportEdge[] = [["x.ts", "y.ts"], ["y.ts", "x.ts"]];
    expect(traceCycle(["x.ts", "y.ts"], e)).toEqual(["x.ts", "y.ts", "x.ts"]);
  });

  it("returns the group unchanged for a single node", () => {
    expect(traceCycle(["solo.ts"], [])).toEqual(["solo.ts"]);
  });
});

describe("findCircularGroups", () => {
  it("detects a 3-node SCC among local modules", () => {
    const nodes = [
      { id: "a.ts", local: true },
      { id: "b.ts", local: true },
      { id: "c.ts", local: true },
      { id: "d.ts", local: true },
    ] as any;
    const edges: ImportEdge[] = [
      ["a.ts", "b.ts"],
      ["b.ts", "c.ts"],
      ["c.ts", "a.ts"],
      ["d.ts", "a.ts"], // d feeds in but no cycle back
    ];
    const groups = findCircularGroups(nodes, edges);
    expect(groups).toHaveLength(1);
    expect(groups[0].sort()).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("ignores cycles through node_modules", () => {
    const nodes = [
      { id: "app.ts", local: true },
      { id: "node_modules/lib/index.js", local: false },
    ] as any;
    const edges: ImportEdge[] = [
      ["app.ts", "node_modules/lib/index.js"],
      ["node_modules/lib/index.js", "app.ts"],
    ];
    expect(findCircularGroups(nodes, edges)).toHaveLength(0);
  });
});
