import { describe, expect, it } from "vitest";
import { findCircularGroups } from "./cycles";
import type { ImportEdge, ModuleNode } from "./types";

const node = (id: string): ModuleNode => ({ id, local: !id.includes("node_modules") });
void node;
const local = (id: string): ModuleNode => ({ id, local: true });
const pkg = (id: string, name: string): ModuleNode => ({
  id,
  local: false,
  pkg: name,
});

describe("findCircularGroups", () => {
  it("finds a simple 3-node cycle among local modules", () => {
    const nodes = [local("src/a.ts"), local("src/b.ts"), local("src/c.ts")];
    const edges: ImportEdge[] = [
      ["src/a.ts", "src/b.ts"],
      ["src/b.ts", "src/c.ts"],
      ["src/c.ts", "src/a.ts"],
    ];
    expect(findCircularGroups(nodes, edges)).toEqual([["src/a.ts", "src/b.ts", "src/c.ts"]]);
  });

  it("ignores cycles that only pass through packages", () => {
    const nodes = [
      local("src/main.ts"),
      pkg("node_modules/lodash/index.js", "lodash"),
    ];
    const edges: ImportEdge[] = [
      ["node_modules/lodash/index.js", "src/main.ts"],
      ["src/main.ts", "node_modules/lodash/index.js"],
    ];
    expect(findCircularGroups(nodes, edges)).toEqual([]);
  });

  it("returns empty for an acyclic graph", () => {
    const nodes = [local("src/a.ts"), local("src/b.ts"), local("src/c.ts")];
    const edges: ImportEdge[] = [
      ["src/a.ts", "src/b.ts"],
      ["src/b.ts", "src/c.ts"],
    ];
    expect(findCircularGroups(nodes, edges)).toEqual([]);
  });
});