import type { BundlerKind } from "./types";

/**
 * A package identified from a module path.
 *
 * `fullName` is the installable name (`pkg` or `@scope/pkg`) used as the
 * canonical key in the report. `version` is only captured when it can be
 * read reliably from a pnpm virtual-store directory.
 */
export interface ResolvedPackage {
  name: string;
  scope?: string;
  version?: string;
  source: BundlerKind;
  fullName: string;
}

const NODE_MODULES = "node_modules";
const PNPM_VIRTUAL_DIR = ".pnpm";

/** `@babel+core@7.24.0` style (scope encoded with `+`). */
const SCOPED_VIRTUAL_DIR = /^(@[^@+]+(?:\+[^@]+)?)@(.+)$/;
/** `lodash@4.17.21_react@18.2.0` style (peer suffix after `_`). */
const PLAIN_VIRTUAL_DIR = /^([^@/]+)@(.+)$/;

interface VirtualDirInfo {
  /** Dir name before the version separator (scope encoded with `+`). */
  encodedName: string;
  /** Version with any peer-dependency suffix stripped. */
  version?: string;
}

function parseVirtualDir(dir: string): VirtualDirInfo {
  const scoped = SCOPED_VIRTUAL_DIR.exec(dir);
  if (scoped) {
    return { encodedName: scoped[1], version: stripPeerSuffix(scoped[2]) };
  }
  const plain = PLAIN_VIRTUAL_DIR.exec(dir);
  if (plain) {
    return { encodedName: plain[1], version: stripPeerSuffix(plain[2]) };
  }
  return { encodedName: dir };
}

function stripPeerSuffix(version: string): string {
  const underscore = version.indexOf("_");
  return underscore === -1 ? version : version.slice(0, underscore);
}

/**
 * Resolve the package that owns `modulePath`, or `null` when the path does
 * not live under a `node_modules` directory (e.g. application source).
 *
 * Supports:
 * - webpack/npm layouts:  `.../node_modules/<pkg>/...` and
 *   `.../node_modules/@scope/<pkg>/...`
 * - pnpm virtual stores:  `.../node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/...`
 *   (scoped variants encode the scope as `+`, e.g. `@babel+core@7.24.0`)
 */
export function resolvePackageFromPath(modulePath: string): ResolvedPackage | null {
  const segments = modulePath.split("/");
  const nmIndex = segments.indexOf(NODE_MODULES);
  if (nmIndex === -1) return null;

  const after = segments.slice(nmIndex + 1);
  if (after.length === 0) return null;

  if (after[0] === PNPM_VIRTUAL_DIR) {
    return resolvePnpmVirtualPath(after);
  }
  return resolvePlainNodeModules(after);
}

function resolvePnpmVirtualPath(after: string[]): ResolvedPackage | null {
  // after = ['.pnpm', '<pkg>@<ver>', 'node_modules', ...pathInsidePkg]
  const dir = after[1];
  if (!dir) return null;

  const innerNm = after.lastIndexOf(NODE_MODULES);
  const inside = innerNm === -1 ? after.slice(2) : after.slice(innerNm + 1);
  const pair = readNamePair(inside);
  if (!pair) return null;

  const { name, scope, fullName } = pair;
  const info = parseVirtualDir(dir);
  const resolved: ResolvedPackage = {
    name,
    scope,
    source: "pnpm",
    fullName,
  };
  // Only claim the version when the virtual-store dir matches this package.
  if (info.encodedName === fullName.replace("/", "+")) {
    resolved.version = info.version;
  }
  return resolved;
}

function resolvePlainNodeModules(after: string[]): ResolvedPackage | null {
  // after = ['<pkg>', ...] or ['@scope', '<pkg>', ...]
  const pair = readNamePair(after);
  if (!pair) return null;
  return { name: pair.name, scope: pair.scope, source: "webpack", fullName: pair.fullName };
}

function readNamePair(
  segments: string[],
): { name: string; scope?: string; fullName: string } | null {
  const first = segments[0];
  if (!first || first === "" || first.startsWith(".")) return null;

  if (first.startsWith("@")) {
    const second = segments[1];
    if (!second) return null;
    return { name: second, scope: first, fullName: `${first}/${second}` };
  }
  return { name: first, fullName: first };
}
