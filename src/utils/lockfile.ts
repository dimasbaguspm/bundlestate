import type { LockfileFormat } from "./types";

export interface LockPkg {
  name: string;
  version?: string;
  dependencies: string[];
}

export interface LockfileData {
  format: LockfileFormat;
  packages: LockPkg[];
  /** Direct (top-level) dependencies of the app. */
  rootDeps: string[];
}

export interface LockfileEntry {
  name: string;
  format: LockfileFormat;
}

const LOCKFILE_NAMES: Array<[string, LockfileFormat]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
];

export function detectLockfileEntry(entryNames: string[]): LockfileEntry | null {
  const names = new Set(entryNames);
  for (const [name, format] of LOCKFILE_NAMES) {
    if (names.has(name)) return { name, format };
  }
  return null;
}

export function parseLockfile(name: string, content: string): LockfileData {
  if (name === "pnpm-lock.yaml") return parsePnpmLock(content);
  if (name === "package-lock.json") return parseNpmLock(content);
  // yarn.lock is detected but not parsed in this iteration.
  return { format: "yarn", packages: [], rootDeps: [] };
}

/**
 * Minimal line-based parser for pnpm-lock.yaml v6/v9 package sections.
 * Extracts package name/version and direct `dependencies:` entries plus the
 * importer's top-level dependencies. Unknown sections are ignored.
 */
export function parsePnpmLock(yaml: string): LockfileData {
  const packages: LockPkg[] = [];
  const rootDeps: string[] = [];

  let section: string | null = null;
  let pkg: LockPkg | null = null;
  let inPkgDeps = false;
  let inRootDeps = false;

  for (const rawLine of yaml.split(/\r?\n/)) {
    const indent = countIndent(rawLine);
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (indent === 0) {
      if (line.endsWith(":")) {
        section = line.slice(0, -1).trim();
        pkg = null;
        inPkgDeps = false;
        inRootDeps = false;
      } else {
        section = null;
      }
      continue;
    }

    if (section === "packages" && indent === 2 && line.endsWith(":")) {
      pkg = parseLockKey(line);
      packages.push(pkg);
      inPkgDeps = false;
      continue;
    }

    if (section === "packages" && indent === 4 && pkg) {
      inPkgDeps = line === "dependencies:";
      continue;
    }

    if (section === "packages" && indent === 6 && inPkgDeps && pkg) {
      const dep = parseDepName(line);
      if (dep) pkg.dependencies.push(dep);
      continue;
    }

    if (section === "importers" && indent === 2 && line === ".") {
      continue;
    }
    if (section === "importers" && indent === 4) {
      inRootDeps = line === "dependencies:";
      continue;
    }
    if (section === "importers" && indent === 6 && inRootDeps) {
      const dep = parseDepName(line);
      if (dep) rootDeps.push(dep);
    }
  }

  return { format: "pnpm", packages, rootDeps };
}

/** Minimal npm `package-lock.json` v2/v3 parser. */
export function parseNpmLock(json: string): LockfileData {
  const packages: LockPkg[] = [];
  const rootDeps: string[] = [];
  try {
    const doc = JSON.parse(json) as {
      packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
    };
    for (const [key, info] of Object.entries(doc.packages ?? {})) {
      const name = npmLockKeyToName(key);
      if (!name) {
        // The root entry (key '') lists the app's direct dependencies.
        for (const dep of Object.keys(info.dependencies ?? {})) rootDeps.push(dep);
        continue;
      }
      packages.push({
        name,
        version: info.version,
        dependencies: Object.keys(info.dependencies ?? {}),
      });
    }
  } catch {
    // Malformed lockfiles degrade to an empty graph.
  }
  return { format: "npm", packages, rootDeps };
}

function npmLockKeyToName(key: string): string | null {
  const marker = "node_modules/";
  const index = key.indexOf(marker);
  if (index === -1) return null;
  return key.slice(index + marker.length);
}

function parseLockKey(line: string): LockPkg {
  const key = stripQuotes(line.slice(0, -1).trim());
  // name = [@scope/]name (no '@' inside), then '@<version>' where the version
  // may carry a peer suffix: react-dom@18.3.1(react@18.3.1)
  const match = /^((?:@[^/]+\/)?[^@]+)@(.+)$/.exec(key);
  if (match) {
    return { name: match[1], version: stripLockVersionSuffix(match[2]), dependencies: [] };
  }
  return { name: key, dependencies: [] };
}

function stripLockVersionSuffix(version: string): string {
  for (let i = 0; i < version.length; i++) {
    const ch = version[i];
    if (ch === "(" || ch === "_" || ch === "/") return version.slice(0, i);
  }
  return version;
}

function parseDepName(line: string): string | null {
  const name = stripQuotes(line.split(":")[0].trim());
  return name ? name : null;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"]|['"]$/g, "");
}

function countIndent(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === " ") n += 1;
    else break;
  }
  return n;
}
