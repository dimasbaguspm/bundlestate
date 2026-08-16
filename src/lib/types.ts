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
  insights: Insights;
}

/** A built JS asset shipped by the bundle. */
export interface Asset {
  name: string;
  sizeBytes: number;
  /** gzip size computed in the worker; `null` when it could not be computed. */
  gzipBytes: number | null;
  /** Package fullNames resolved from the asset's `.map` sources. */
  usedModules: string[];
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

/** Skeleton insight flags — extend in later iterations. */
export interface Insights {
  /** Declared dependencies not found in any asset's source maps. */
  unusedDeclaredDeps: string[];
  /** total gzip / total raw size across assets, or `null`. */
  gzipRatio: number | null;
  /** Names of the 5 largest assets, descending. */
  largestAssets: string[];
  totalSizeBytes: number;
  totalGzipBytes: number | null;
}
