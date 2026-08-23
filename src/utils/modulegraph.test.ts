import { describe, expect, it } from "vitest";
import {
  extractImportSpecifiers,
  extractModuleGraph,
  normalizePath,
  resolveImport,
} from "./modulegraph";
import type { ParsedAsset } from "./parse-assets";

const text = (s: string) => new TextEncoder().encode(s);
void text;

function asset(over: Partial<ParsedAsset> & { name: string }): ParsedAsset {
  return { sizeBytes: 0, bytes: new Uint8Array(0), ...over };
}

describe("extractImportSpecifiers", () => {
  it("captures esm, side-effect and re-export specifiers", () => {
    const code = `
import { a } from "./util/a";
import "./polyfill";
export { b } from "./util/b";
export { default } from "pkg/entry";
const c = require("cjs-dep");
`;
    expect(extractImportSpecifiers(code)).toEqual([
      "./util/a",
      "./polyfill",
      "./util/b",
      "pkg/entry",
      "cjs-dep",
    ]);
  });

  it("skips node: builtins but captures dynamic imports", () => {
    expect(
      extractImportSpecifiers(`import fs from "node:fs"; const x = import("./lazy");`),
    ).toEqual(["./lazy"]);
  });
});

describe("normalizePath", () => {
  it("collapses . and .. segments", () => {
    expect(normalizePath("dist/assets/../../node_modules/react/index.js")).toBe(
      "node_modules/react/index.js",
    );
    expect(normalizePath("./src/App.tsx")).toBe("src/App.tsx");
  });
});

describe("resolveImport", () => {
  const known = new Set([
    "src/pages/Dashboard.tsx",
    "node_modules/react/index.js",
    "node_modules/.pnpm/@floating-ui+dom@1.8.0/node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs",
    "node_modules/lodash/fp.js",
  ]);

  it("resolves relative imports with extension probing", () => {
    expect(resolveImport("./pages/Dashboard", "src/index.ts", known)).toBe(
      "src/pages/Dashboard.tsx",
    );
  });

  it("resolves bare specifiers into node_modules", () => {
    expect(resolveImport("react", "src/index.ts", known)).toBe("node_modules/react/index.js");
    expect(resolveImport("lodash/fp", "src/index.ts", known)).toBe("node_modules/lodash/fp.js");
    expect(resolveImport("@floating-ui/dom", "src/index.ts", known)).toBe(
      "node_modules/.pnpm/@floating-ui+dom@1.8.0/node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs",
    );
  });

  it("does not match a bare specifier as a prefix of another package", () => {
    const tight = new Set(["node_modules/lodash/index.js", "node_modules/lodashish/index.js"]);
    expect(resolveImport("lodash", "src/index.ts", tight)).toBe("node_modules/lodash/index.js");
  });

  it("returns null for unresolvable specifiers", () => {
    expect(resolveImport("missing-pkg", "src/index.ts", known)).toBeNull();
    expect(resolveImport("./nope", "src/index.ts", known)).toBeNull();
  });
});

describe("extractModuleGraph", () => {
  it("builds nodes and deduplicated edges from sourcesContent", () => {
    const assets = [
      asset({
        name: "dist/assets/index.js",
        mapSources: ["../src/App.tsx", "../../node_modules/react/index.js"],
        mapContents: [`import { render } from "react";`, `export const version = "18.3.1";`],
      }),
      asset({
        name: "dist/assets/chunk.js",
        mapSources: ["../../node_modules/react/index.js"],
        mapContents: [],
      }),
    ];

    const graph = extractModuleGraph(assets);
    expect(graph.hasContents).toBe(true);

    const ids = graph.nodes.map((n) => n.id).sort();
    // "../src/App.tsx" relative to dist/assets canonicalizes to dist/src/App.tsx;
    // "../../node_modules/react/index.js" collapses to node_modules/react/index.js.
    expect(ids).toEqual(["dist/src/App.tsx", "node_modules/react/index.js"]);

    const app = graph.nodes.find((n) => n.id === "dist/src/App.tsx")!;
    expect(app.local).toBe(true);
    expect(app.pkg).toBeUndefined();

    const react = graph.nodes.find((n) => n.id === "node_modules/react/index.js")!;
    expect(react.local).toBe(false);
    expect(react.pkg).toBe("react");

    expect(graph.edges).toContainEqual(["dist/src/App.tsx", "node_modules/react/index.js"]);
  });
});
