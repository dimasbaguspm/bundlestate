import { describe, expect, it } from "vitest";
import {
  findInlineMap,
  findSidecarEntry,
  findSidecarRef,
  parseSourceMap,
  usedModulesFromSources,
} from "./sourcemap";

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64");

describe("findInlineMap", () => {
  it("extracts a base64 data-URL source map comment", () => {
    const map = { sources: ["webpack:///./src/App.tsx"], version: 3 };
    const text = `console.log(1);\n//# sourceMappingURL=data:application/json;base64,${b64(map)}`;
    expect(findInlineMap(text)).toBe(JSON.stringify(map));
  });

  it("supports the charset parameter in the data URL", () => {
    const map = { sources: [] };
    const text = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${b64(map)}`;
    expect(findInlineMap(text)).toBe(JSON.stringify(map));
  });

  it("supports the legacy //@ directive form", () => {
    const map = { sources: [] };
    const text = `//@ sourceMappingURL=data:application/json;base64,${b64(map)}`;
    expect(findInlineMap(text)).toBe(JSON.stringify(map));
  });

  it("returns null when no inline map is present", () => {
    expect(findInlineMap("console.log(1);\n//# sourceMappingURL=main.js.map")).toBeNull();
    expect(findInlineMap("no map here")).toBeNull();
  });
});

describe("findSidecarRef", () => {
  it("extracts the referenced map file name", () => {
    expect(findSidecarRef("console.log(1);\n//# sourceMappingURL=static/js/main.abc.js.map")).toBe(
      "static/js/main.abc.js.map",
    );
  });

  it("returns null when the comment references an inline map", () => {
    expect(
      findSidecarRef(`//# sourceMappingURL=data:application/json;base64,${b64({ sources: [] })}`),
    ).toBeNull();
  });

  it("returns null without a sourceMappingURL comment", () => {
    expect(findSidecarRef("console.log(1);")).toBeNull();
  });
});

describe("findSidecarEntry", () => {
  const entries = [
    "static/js/main.abc.js",
    "static/js/main.abc.js.map",
    "static/js/vendor.def.js",
    "static/js/vendor.def.js.map",
  ];

  it("finds the sidecar map by full path", () => {
    expect(findSidecarEntry("static/js/main.abc.js", entries)).toBe("static/js/main.abc.js.map");
  });

  it("finds the sidecar map by basename when the asset path differs", () => {
    expect(findSidecarEntry("vendor.def.js", entries)).toBe("static/js/vendor.def.js.map");
  });

  it("returns null when no sidecar map exists", () => {
    expect(findSidecarEntry("static/js/nope.js", entries)).toBeNull();
  });
});

describe("parseSourceMap", () => {
  it("parses a map with sources", () => {
    expect(parseSourceMap(JSON.stringify({ version: 3, sources: ["a.js", "b.js"] }))).toEqual({
      sources: ["a.js", "b.js"],
    });
  });

  it("tolerates invalid JSON", () => {
    expect(parseSourceMap("not json")).toEqual({ sources: [] });
  });

  it("defaults missing sources to an empty array", () => {
    expect(parseSourceMap(JSON.stringify({ version: 3 }))).toEqual({ sources: [] });
  });
});

describe("usedModulesFromSources", () => {
  it("resolves package names and filters out app code", () => {
    const sources = [
      "webpack:///./src/App.tsx",
      "webpack:///./node_modules/lodash/index.js",
      "webpack:///./node_modules/@babel/core/lib/index.js",
      "webpack:///./node_modules/lodash/fp.js",
    ];
    expect(usedModulesFromSources(sources)).toEqual(["lodash", "@babel/core"]);
  });

  it("deduplicates repeated packages", () => {
    expect(
      usedModulesFromSources(["node_modules/react/index.js", "node_modules/react/jsx-runtime.js"]),
    ).toEqual(["react"]);
  });

  it("returns an empty array when nothing resolves", () => {
    expect(usedModulesFromSources(["webpack:///./src/index.tsx"])).toEqual([]);
  });
});
