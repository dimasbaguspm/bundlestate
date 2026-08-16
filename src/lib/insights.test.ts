import { describe, expect, it } from "vitest";
import { computeVersionClashes } from "./insights";
import type { ModuleGraph, ModuleNode } from "./types";

const pnpmSource = (pkgName: string, version: string) =>
  `../../node_modules/.pnpm/${pkgName.replace("/", "+")}@${version}/node_modules/${pkgName}/index.js`;

function pnpmId(pkgName: string, version: string): string {
  return `node_modules/.pnpm/${pkgName.replace("/", "+")}@${version}/node_modules/${pkgName}/index.js`;
}

describe("computeVersionClashes", () => {
  it("flags the same package in two versions from pnpm paths", () => {
    const clashes = computeVersionClashes([
      [pnpmSource("uuid", "3.4.0"), pnpmSource("react", "18.3.1")],
      [pnpmSource("uuid", "8.3.2")],
    ]);

    expect(clashes.map((c) => c.fullName)).toEqual(["uuid"]);
    const uuid = clashes[0];
    expect(uuid.versions.map((v) => v.version).sort()).toEqual(["3.4.0", "8.3.2"]);
  });

  it("attaches importing parent packages when a module graph exists", () => {
    const nodes: ModuleNode[] = [
      { id: pnpmId("uuid", "8.3.2"), pkg: "uuid", version: "8.3.2", local: false },
      { id: pnpmId("react", "18.3.1"), pkg: "react", version: "18.3.1", local: false },
    ];
    const graph: ModuleGraph = {
      nodes,
      edges: [
        [pnpmId("react", "18.3.1"), pnpmId("uuid", "8.3.2")],
      ],
      pkgModules: {
        uuid: [pnpmId("uuid", "8.3.2")],
        react: [pnpmId("react", "18.3.1")],
      },
      hasContents: true,
    };

    const clashes = computeVersionClashes(
      [[pnpmSource("uuid", "3.4.0")], [pnpmSource("uuid", "8.3.2")]],
      graph,
    );
    const v8 = clashes[0].versions.find((v) => v.version === "8.3.2")!;
    expect(v8.importedBy).toContain("react");
  });

  it("returns [] when versions are unknown", () => {
    expect(computeVersionClashes([["node_modules/react/index.js"]])).toEqual([]);
  });
});