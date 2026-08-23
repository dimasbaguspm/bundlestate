import { describe, expect, it } from "vitest";
import { resolvePackageFromPath, type ResolvedPackage } from "./resolver";

describe("resolvePackageFromPath", () => {
  it("resolves an unscoped package in a webpack/node_modules layout", () => {
    expect(
      resolvePackageFromPath("webpack:///./node_modules/lodash/index.js"),
    ).toEqual<ResolvedPackage>({
      name: "lodash",
      fullName: "lodash",
      source: "webpack",
    });
  });

  it("resolves a scoped package in a webpack/node_modules layout", () => {
    expect(
      resolvePackageFromPath("/app/node_modules/@babel/core/lib/index.js"),
    ).toEqual<ResolvedPackage>({
      name: "core",
      scope: "@babel",
      fullName: "@babel/core",
      source: "webpack",
    });
  });

  it("captures the version from a pnpm virtual-store path", () => {
    expect(
      resolvePackageFromPath("/app/node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/fp.js"),
    ).toEqual<ResolvedPackage>({
      name: "lodash",
      fullName: "lodash",
      version: "4.17.21",
      source: "pnpm",
    });
  });

  it("resolves a scoped package from a pnpm virtual-store path", () => {
    expect(
      resolvePackageFromPath(
        "/app/node_modules/.pnpm/@babel+core@7.24.0/node_modules/@babel/core/lib/index.js",
      ),
    ).toEqual<ResolvedPackage>({
      name: "core",
      scope: "@babel",
      fullName: "@babel/core",
      version: "7.24.0",
      source: "pnpm",
    });
  });

  it("strips the peer-dependency suffix from a pnpm version", () => {
    expect(
      resolvePackageFromPath(
        "/app/node_modules/.pnpm/lodash@4.17.21_react@18.2.0/node_modules/lodash/index.js",
      ),
    ).toMatchObject({ fullName: "lodash", version: "4.17.21" });
  });

  it("resolves a nested dependency inside a pnpm virtual-store package", () => {
    expect(
      resolvePackageFromPath(
        "/app/node_modules/.pnpm/express@4.18.2/node_modules/express/node_modules/accepts/index.js",
      ),
    ).toMatchObject({ fullName: "accepts", source: "pnpm" });
  });

  it("attaches the version only when the virtual-store dir matches the package", () => {
    expect(
      resolvePackageFromPath(
        "/app/node_modules/.pnpm/express@4.18.2/node_modules/express/lib/express.js",
      ),
    ).toMatchObject({ fullName: "express", version: "4.18.2" });

    const nested = resolvePackageFromPath(
      "/app/node_modules/.pnpm/express@4.18.2/node_modules/express/node_modules/accepts/index.js",
    );
    expect(nested).toMatchObject({ fullName: "accepts" });
    expect(nested?.version).toBeUndefined();
  });

  it("returns null for paths outside node_modules (app code)", () => {
    expect(resolvePackageFromPath("webpack:///./src/App.tsx")).toBeNull();
    expect(resolvePackageFromPath("webpack:///./pages/home/index.js")).toBeNull();
  });

  it("returns null for paths with no node_modules segment", () => {
    expect(resolvePackageFromPath("/usr/lib/whatever.js")).toBeNull();
  });
});
