import { describe, expect, it } from "vitest";
import { runInspector } from "./rules";

const toB64 = (s: string) =>
  typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(s)))
    : Buffer.from(s, "utf-8").toString("base64");

describe("runInspector (PRD §4.3)", () => {
  it("flags RULE-01 circular cycles from insights", () => {
    const f = runInspector({
      assets: [],
      packages: [],
      versionClashes: [],
      circularDepGroups: [["a.ts", "b.ts", "c.ts"]],
    });
    const r1 = f.find((x) => x.rule === "RULE-01");
    expect(r1?.severity).toBe("critical");
    expect(r1?.location).toContain("a.ts");
  });

  it("flags RULE-02 duplicate package drift", () => {
    const f = runInspector({
      assets: [],
      packages: [],
      versionClashes: [
        { fullName: "lodash", versions: [{ version: "4.17.20" }, { version: "4.17.21" }] },
      ],
      circularDepGroups: [],
    });
    expect(f.find((x) => x.rule === "RULE-02")?.severity).toBe("high");
  });

  it("flags RULE-03 CJS require inside ESM context", () => {
    const src = 'import React from "react";\nconst x = require("left-pad");\n';
    const f = runInspector({
      assets: [{ name: "app.js", rawBytes: toB64(src), kind: "js" }],
      packages: [],
      versionClashes: [],
      circularDepGroups: [],
    });
    expect(f.find((x) => x.rule === "RULE-03")?.severity).toBe("high");
  });

  it("does NOT flag RULE-03 for plain CJS (no ESM context)", () => {
    const src = 'const x = require("left-pad");\nmodule.exports = x;\n';
    const f = runInspector({
      assets: [{ name: "cjs.js", rawBytes: toB64(src), kind: "js" }],
      packages: [],
      versionClashes: [],
      circularDepGroups: [],
    });
    expect(f.find((x) => x.rule === "RULE-03")).toBeUndefined();
  });

  it("flags RULE-04 legacy polyfills", () => {
    const f = runInspector({
      assets: [],
      packages: [{ fullName: "core-js/modules/es.array.map" }],
      versionClashes: [],
      circularDepGroups: [],
    });
    expect(f.find((x) => x.rule === "RULE-04")?.severity).toBe("medium");
  });

  it("flags RULE-05 inlined data URI above 10KB", () => {
    const big = "A".repeat(14 * 1024);
    const src = `const img = "data:image/png;base64,${big}";`;
    const f = runInspector({
      assets: [{ name: "inline.js", rawBytes: toB64(src), kind: "js" }],
      packages: [],
      versionClashes: [],
      circularDepGroups: [],
    });
    expect(f.find((x) => x.rule === "RULE-05")?.severity).toBe("medium");
  });

  it("flags RULE-06 unused exports (single-reference)", () => {
    const src = "export const UNUSED_HELPER = 42;\n";
    const f = runInspector({
      assets: [{ name: "exports.js", rawBytes: toB64(src), kind: "js" }],
      packages: [],
      versionClashes: [],
      circularDepGroups: [],
    });
    expect(f.find((x) => x.rule === "RULE-06")?.severity).toBe("low");
  });

  it("sorts by severity (critical first)", () => {
    const f = runInspector({
      assets: [],
      packages: [{ fullName: "core-js" }],
      versionClashes: [{ fullName: "lodash", versions: [{ version: "1" }, { version: "2" }] }],
      circularDepGroups: [["x.ts", "y.ts"]],
    });
    expect(f[0].rule).toBe("RULE-01");
  });
});
