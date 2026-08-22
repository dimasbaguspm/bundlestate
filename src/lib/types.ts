/**
 * Unified data model for a normalized bundle report.
 *
 * A `BundleStateReport` is a plain, JSON-serializable object produced by the
 * NormalizeSubWorker and held in the zustand store — no class instances, no
 * functions, nothing that would break structured cloning.
 */

export type BundlerKind = "webpack" | "pnpm" | "unknown";

export type LockfileFormat = "pnpm" | "npm" | "yarn" | "unknown" | "none";

export interface BundleStateReport {
  id: string;
  sourceName: string;
  generatedAt: string;
  assets: Asset[];
  packages: Package[];
  declaredDeps: DeclaredDeps;
  lockfile: LockfileInfo;
  graph: DependencyGraph;
  /** Module-level import graph (present when maps carried sourcesContent). */
  moduleGraph?: ModuleGraph;
  /** Non-JS/HTML assets shipped by the bundle (images, fonts, json, css…). */
  files?: StaticFile[];
  insights: Insights;
}

/** Non-JS/HTML asset shipped by the bundle. */
export interface StaticFile {
  path: string;
  sizeBytes: number;
  type: StaticFileType;
}

export type StaticFileType =
  | "image"
  | "font"
  | "video"
  | "audio"
  | "json"
  | "css"
  | "text"
  | "other";

/** A built JS asset shipped by the bundle. */
export interface Asset {
  name: string;
  sizeBytes: number;
  /** gzip size computed in the worker; `null` when it could not be computed. */
  gzipBytes: number | null;
  /** Package fullNames resolved from the asset's `.map` sources. */
  usedModules: string[];
  /**
   * Original asset source as a base64 string, so the in-browser Preview
   * sandbox can execute/inspect it without re-reading the zip. Empty string
   * for non-JS assets to keep the report size sane. Stored as base64 (not a
   * raw Uint8Array) so the report stays JSON-serializable for IndexedDB.
   */
  rawBytes: string;
  /** Coarse asset kind, derived from the file extension. */
  kind: "js" | "css" | "html" | "other";
}

/** A package the app actually ships (resolved from source maps). */
export interface Package {
  name: string;
  scope?: string;
  /** Canonical installable name: `pkg` or `@scope/pkg`. */
  fullName: string;
  version?: string;
  source: BundlerKind;
  /** Names of assets whose source maps reference this package. */
  usedIn: string[];
}

export interface DeclaredDeps {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
}

export interface LockfileInfo {
  format: LockfileFormat;
  /** Number of packages parsed from the lockfile. */
  packageCount: number;
  /** Original lockfile file name inside the zip. */
  rawName: string;
}

/** Transitive dependency relationships, from the lockfile. */
export interface DependencyGraph {
  /** app name → its direct (top-level) dependencies. */
  appToPkg: Record<string, string[]>;
  /** package fullName → its direct dependencies. */
  pkgToSubPkg: Record<string, string[]>;
}

/** One module (source file) recovered from a source map. */
export interface ModuleNode {
  /** Canonical module id — the full source path. */
  id: string;
  /** Owning package fullName when the module lives under node_modules. */
  pkg?: string;
  /** Package version when known (pnpm virtual-store paths). */
  version?: string;
  /** Module is application code (outside node_modules). */
  local: boolean;
}

/** A directed import edge between two module ids. */
export type ImportEdge = [from: string, to: string];

/**
 * Module-level import graph extracted from `sourcesContent` in the workers.
 * `pkgModules` maps a package fullName to its module ids. May be absent
 * from the report when the maps carried no source content.
 */
export interface ModuleGraph {
  nodes: ModuleNode[];
  /** Deduplicated directed import edges. */
  edges: ImportEdge[];
  pkgModules: Record<string, string[]>;
  /** True when any map carried `sourcesContent`. */
  hasContents: boolean;
}

/** Same package bundled in more than one version. */
export interface VersionClash {
  fullName: string;
  /** Each distinct bundled version + the parent packages that import it. */
  versions: { version: string; importedBy: string[] }[];
}

export interface Insights {
  /** Declared dependencies not found in any asset's source maps. */
  unusedDeclaredDeps: string[];
  /** total gzip / total raw size across assets, or `null`. */
  gzipRatio: number | null;
  /** Names of the 5 largest assets, descending. */
  largestAssets: string[];
  totalSizeBytes: number;
  totalGzipBytes: number | null;
  /** Duplicate-version packages (uuid@3 alongside uuid@8 etc.). */
  versionClashes: VersionClash[];
  /** Module-level import cycles among local source files (each = cycle members). */
  circularDepGroups: string[][];
  circularDepCount: number;
  /** Lineage availability: module graph stats or why it is missing. */
  lineage: { available: boolean; nodes: number; edges: number; reason?: string };
}
