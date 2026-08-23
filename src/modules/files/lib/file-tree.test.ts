import { describe, expect, it } from "vitest";
import { buildFileTree, countFiles } from "./file-tree";
import type { BundleStateReport } from "@/utils/types";

function report(): BundleStateReport {
  return {
    id: "r",
    sourceName: "app.zip",
    generatedAt: new Date().toISOString(),
    assets: [
      {
        name: "assets/app.js",
        sizeBytes: 100,
        gzipBytes: 40,
        usedModules: ["react"],
        rawBytes: btoa("console.log(1)"),
        kind: "js",
      },
      {
        name: "assets/style.css",
        sizeBytes: 50,
        gzipBytes: 20,
        usedModules: [],
        rawBytes: btoa("a{}"),
        kind: "css",
      },
      { name: "no-raw.js", sizeBytes: 1, gzipBytes: 1, usedModules: [], rawBytes: "", kind: "js" },
    ],
    packages: [],
    declaredDeps: { dependencies: {}, devDependencies: {}, peerDependencies: {} },
    lockfile: { format: "none", packageCount: 0, rawName: "" },
    graph: { appToPkg: {}, pkgToSubPkg: {} },
    files: [
      { path: "images/logo.png", sizeBytes: 999, type: "image", rawBytes: btoa("pngbytes") },
      { path: "images/icon.svg", sizeBytes: 10, type: "image" },
    ],
    insights: {
      unusedDeclaredDeps: [],
      gzipRatio: null,
      largestAssets: [],
      totalSizeBytes: 0,
      totalGzipBytes: null,
      versionClashes: [],
      circularDepGroups: [],
      circularDepCount: 0,
      lineage: { available: false, nodes: 0, edges: 0 },
    },
  };
}

describe("buildFileTree", () => {
  it("nests assets and static files into a directory tree", () => {
    const root = buildFileTree(report());
    const assets = root.children.find((c) => c.name === "assets");
    expect(assets).toBeDefined();
    expect(assets!.children.map((c) => c.name).sort()).toEqual(["app.js", "style.css"]);
    const images = root.children.find((c) => c.name === "images");
    expect(images!.children.map((c) => c.name).sort()).toEqual(["icon.svg", "logo.png"]);
  });

  it("attaches decoded content to previewable leaves", () => {
    const root = buildFileTree(report());
    const app = root.children
      .find((c) => c.name === "assets")!
      .children.find((c) => c.name === "app.js")!;
    expect(app.asset?.rawBytes).toBe(btoa("console.log(1)"));
    const logo = root.children
      .find((c) => c.name === "images")!
      .children.find((c) => c.name === "logo.png")!;
    expect(logo.staticFile?.rawBytes).toBe(btoa("pngbytes"));
    const icon = root.children
      .find((c) => c.name === "images")!
      .children.find((c) => c.name === "icon.svg")!;
    expect(icon.staticFile?.rawBytes).toBeUndefined();
  });

  it("counts all file leaves that carry previewable content", () => {
    // assets/app.js, assets/style.css (have rawBytes), images/logo.png (has rawBytes),
    // images/icon.svg (metadata only, still a leaf). no-raw.js is skipped (empty rawBytes).
    expect(countFiles(buildFileTree(report()))).toBe(4);
  });
});
