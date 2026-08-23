import { describe, expect, it } from "vitest";
import { untar } from "./tar";
import { buildTar, decodeEntry } from "@/test/tar-fixture";

describe("untar", () => {
  it("extracts regular files with names and content", () => {
    const tar = buildTar([
      { name: "dist/a.js", content: "console.log('a');" },
      { name: "node_modules/react/index.js", content: "export const react = 1;" },
    ]);

    const entries = untar(tar);

    expect(entries.map((e) => e.name)).toEqual(["dist/a.js", "node_modules/react/index.js"]);
    expect(decodeEntry(entries[0])).toBe("console.log('a');");
    expect(decodeEntry(entries[1])).toBe("export const react = 1;");
  });

  it("skips directory entries without losing following files", () => {
    const tar = buildTar([{ name: "dist/a.js", content: "x" }], { dirs: ["dist"] });

    const entries = untar(tar);
    expect(entries.map((e) => e.name)).toEqual(["dist/a.js"]);
  });

  it("applies pax path records for long file names", () => {
    const longName = `${"node_modules/@some-scope/pkg/".padEnd(200, "x")}.js`;
    const tar = buildTar([{ name: longName, content: "content", paxPath: true }]);

    const entries = untar(tar);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe(longName);
    expect(decodeEntry(entries[0])).toBe("content");
  });

  it("returns an empty list for an empty tar", () => {
    expect(untar(buildTar([]))).toEqual([]);
  });
});
