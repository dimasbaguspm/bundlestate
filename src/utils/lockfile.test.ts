import { describe, expect, it } from "vitest";
import { detectLockfileEntry, parseLockfile, parseNpmLock, parsePnpmLock } from "./lockfile";

describe("detectLockfileEntry", () => {
  it("detects pnpm, npm and yarn lockfiles by name", () => {
    expect(detectLockfileEntry(["dist/main.js", "pnpm-lock.yaml"])).toEqual({
      name: "pnpm-lock.yaml",
      format: "pnpm",
    });
    expect(detectLockfileEntry(["package-lock.json"])).toEqual({
      name: "package-lock.json",
      format: "npm",
    });
    expect(detectLockfileEntry(["yarn.lock"])).toEqual({ name: "yarn.lock", format: "yarn" });
  });

  it("returns null when no lockfile is present", () => {
    expect(detectLockfileEntry(["dist/main.js", "package.json"])).toBeNull();
  });
});

describe("parsePnpmLock", () => {
  const LOCK = `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      react:
        specifier: ^18.3.1
        version: 18.3.1

packages:
  react@18.3.1:
    resolution: {integrity: sha512-abc}
  '@babel/core@7.24.0':
    resolution: {integrity: sha512-def}
    dependencies:
      '@babel/helper-compilation-targets': 7.24.0
  react-dom@18.3.1(react@18.3.1):
    resolution: {integrity: sha512-ghi}
    dependencies:
      react: 18.3.1
`;

  it("extracts root dependencies from the importer", () => {
    const data = parsePnpmLock(LOCK);
    expect(data.format).toBe("pnpm");
    expect(data.rootDeps).toEqual(["react"]);
  });

  it("parses packages with versions, scopes and deps", () => {
    const data = parsePnpmLock(LOCK);
    expect(data.packages.map((p) => p.name)).toEqual(["react", "@babel/core", "react-dom"]);
    expect(data.packages.find((p) => p.name === "react")?.version).toBe("18.3.1");
    expect(data.packages.find((p) => p.name === "@babel/core")?.dependencies).toEqual([
      "@babel/helper-compilation-targets",
    ]);
  });

  it("strips peer-dependency suffixes from versions", () => {
    const data = parsePnpmLock(LOCK);
    expect(data.packages.find((p) => p.name === "react-dom")?.version).toBe("18.3.1");
  });
});

describe("parseNpmLock", () => {
  it("parses package-lock v3 packages and root deps", () => {
    const doc = JSON.stringify({
      name: "app",
      lockfileVersion: 3,
      packages: {
        "": { name: "app", dependencies: { react: "^18.3.1" } },
        "node_modules/react": {
          version: "18.3.1",
          dependencies: { "react-dom": "18.3.1" },
        },
        "node_modules/@babel/core": { version: "7.24.0" },
      },
    });
    const data = parseNpmLock(doc);
    expect(data.rootDeps).toEqual(["react"]);
    expect(data.packages.map((p) => p.name)).toEqual(["react", "@babel/core"]);
    expect(data.packages.find((p) => p.name === "react")?.dependencies).toEqual(["react-dom"]);
  });

  it("degrades gracefully on malformed JSON", () => {
    const data = parseNpmLock("not json");
    expect(data.packages).toEqual([]);
    expect(data.rootDeps).toEqual([]);
  });
});

describe("parseLockfile", () => {
  it("routes by file name and returns a yarn skeleton", () => {
    expect(parseLockfile("pnpm-lock.yaml", "lockfileVersion: 9.0").format).toBe("pnpm");
    expect(parseLockfile("package-lock.json", "{}").format).toBe("npm");
    expect(parseLockfile("yarn.lock", "# yarn").format).toBe("yarn");
  });
});
