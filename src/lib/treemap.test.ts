import { describe, expect, it } from "vitest";
import { buildTreemap, highlightNode } from "./treemap";
import type { BundleStateReport } from "./types";

const report = {
  assets: [
    {
      name: "a.js",
      sizeBytes: 100,
      usedModules: ["react", "lodash"],
    },
  ],
} as unknown as BundleStateReport;

describe("buildTreemap", () => {
  it("splits asset bytes across its packages", () => {
    const data = buildTreemap(report);
    expect(data[0].name).toBe("a.js");
    expect(data[0].value).toBe(100);
    const children = data[0].children ?? [];
    expect(children.map((c) => c.name)).toEqual(["react", "lodash"]);
    expect(children[0].value).toBe(50);
  });
});

describe("highlightNode", () => {
  it("marks the matching leaf without mutating the input", () => {
    const data = buildTreemap(report);
    const marked = highlightNode(data, "react");

    expect(marked[0].children![0].itemStyle).toEqual({ color: "#eecd85" });
    expect(marked[0].children![1].itemStyle).toBeUndefined();
    // Original untouched — fresh tree, not a mutation of the source.
    expect(data[0].children![0].itemStyle).toBeUndefined();
  });

  it("leaves the tree unchanged when nothing matches", () => {
    const marked = highlightNode(buildTreemap(report), "nope");
    expect(marked[0].children![0].itemStyle).toBeUndefined();
  });
});