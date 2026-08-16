import { describe, expect, it } from "vitest";
import { buildFileGroups, collectStaticFiles, fileType } from "./files";
import type { ZipEntry } from "./zip";

const entry = (name: string, sizeBytes: number): ZipEntry => ({
  name,
  sizeBytes,
  bytes: new Uint8Array(),
});

describe("fileType", () => {
  it("classifies common static types by extension", () => {
    expect(fileType("assets/logo.svg")).toBe("image");
    expect(fileType("fonts/a.woff2")).toBe("font");
    expect(fileType("data.json")).toBe("json");
    expect(fileType("app.css")).toBe("css");
    expect(fileType("clip.mp4")).toBe("video");
    expect(fileType("sound.mp3")).toBe("audio");
    expect(fileType("readme.md")).toBe("text");
    expect(fileType("favicon.unknown")).toBe("other");
  });
});

describe("collectStaticFiles", () => {
  it("keeps non-JS/HTML assets and drops scripts, maps, html and meta files", () => {
    const files = collectStaticFiles([
      entry("index.html", 10),
      entry("assets/index.js", 100),
      entry("assets/index.js.map", 500),
      entry("assets/logo.png", 2000),
      entry("fonts/a.woff2", 3000),
      entry("app.css", 400),
      entry("package.json", 50),
      entry("pnpm-lock.yaml", 20),
      entry("node_modules/x/dist.js", 90),
      entry("assets/data.json", 30),
    ]);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("assets/logo.png");
    expect(paths).toContain("fonts/a.woff2");
    expect(paths).toContain("app.css");
    expect(paths).toContain("assets/data.json");
    expect(paths).not.toContain("index.html");
    expect(paths).not.toContain("assets/index.js");
    expect(paths).not.toContain("assets/index.js.map");
    expect(paths).not.toContain("package.json");
    expect(paths).not.toContain("pnpm-lock.yaml");
    expect(paths).not.toContain("node_modules/x/dist.js");
    expect(files[0].sizeBytes).toBe(3000); // sorted by size desc
  });

  it("groups by type with totals", () => {
    const groups = buildFileGroups([
      { path: "a.png", sizeBytes: 100, type: "image" },
      { path: "b.png", sizeBytes: 50, type: "image" },
      { path: "c.woff2", sizeBytes: 300, type: "font" },
    ]);
    expect(groups[0].type).toBe("font");
    expect(groups[0].totalBytes).toBe(300);
    expect(groups[1].type).toBe("image");
    expect(groups[1].totalBytes).toBe(150);
    expect(groups[1].files.length).toBe(2);
  });
});
