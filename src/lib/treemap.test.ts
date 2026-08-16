import { describe, expect, it } from "vitest";
import { filterTreemap, type TreemapNode } from "./treemap";

const tree: TreemapNode[] = [
  {
    name: "index.js",
    children: [
      { name: "react", value: 50 },
      { name: "lodash", value: 30 },
      { name: "uuid", value: 20 },
    ],
  },
  {
    name: "worker.js",
    children: [
      { name: "fflate", value: 40 },
      { name: "react", value: 10 },
    ],
  },
];

describe("filterTreemap", () => {
  it("returns the tree unchanged for an empty query", () => {
    expect(filterTreemap(tree, "  ")).toEqual(tree);
  });

  it("keeps only branches with matching package leaves", () => {
    const out = filterTreemap(tree, "react");
    expect(out).toEqual([
      { name: "index.js", children: [{ name: "react", value: 50 }] },
      { name: "worker.js", children: [{ name: "react", value: 10 }] },
    ]);
  });

  it("drops asset parents with no matching child", () => {
    const out = filterTreemap(tree, "lodash");
    expect(out).toEqual([{ name: "index.js", children: [{ name: "lodash", value: 30 }] }]);
  });

  it("is case-insensitive and returns [] when nothing matches", () => {
    expect(filterTreemap(tree, "NOPE")).toEqual([]);
  });
});
