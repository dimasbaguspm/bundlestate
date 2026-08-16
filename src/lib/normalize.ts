import { detectBundler } from "./autodetect";
import { computeInsights } from "./insights";
import { detectLockfileEntry, parseLockfile, type LockPkg } from "./lockfile";
import { resolvePackageFromPath } from "./resolver";
import { usedModulesFromSources } from "./sourcemap";
import type { Asset, BundleStateReport, DeclaredDeps, DependencyGraph, Package } from "./types";
import type { ZipEntry } from "./zip";

/** An asset as produced by the parse worker, before normalization. */
export interface RawAsset {
  name: string;
  sizeBytes: number;
  bytes: Uint8Array;
  /** Package-owned module paths from the asset's source map. */
  mapSources?: string[];
}

export interface NormalizeInput {
  sourceName: string;
  assets: RawAsset[];
  /** All zip entries (used for package.json / lockfile discovery). */
  entries: ZipEntry[];
}

const DECODER = new TextDecoder();

/**
 * Compute the gzip size of `bytes` using the platform `CompressionStream`.
 * Runs in the NormalizeSubWorker (and Node 24 for tests).
 */
export async function gzipSize(bytes: Uint8Array): Promise<number> {
  const compression = new CompressionStream("gzip");
  const writer = compression.writable.getWriter();
  void writer.write(bytes as BufferSource);
  void writer.close();
  const compressed = await new Response(compression.readable).arrayBuffer();
  return compressed.byteLength;
}

/**
 * Build the normalized `BundleStateReport` from parse-worker output:
 * gzip sizes, package aggregation from source maps, declared deps from the
 * root package.json, the dependency graph from the lockfile, and insights.
 */
export async function normalizeBundle(input: NormalizeInput): Promise<BundleStateReport> {
  const { assets: rawAssets, entries } = input;

  const assets = await Promise.all(
    rawAssets.map(async (raw): Promise<Asset> => ({
      name: raw.name,
      sizeBytes: raw.sizeBytes,
      gzipBytes: await gzipSize(raw.bytes),
      usedModules: usedModulesFromSources(raw.mapSources ?? []),
    })),
  );

  const bundler = detectBundler([
    ...entries.map((e) => e.name),
    ...rawAssets.flatMap((a) => a.mapSources ?? []),
  ]);

  const packages = aggregatePackages(assets, bundler);

  const declaredDeps = readDeclaredDeps(entries);
  const lockfileEntry = detectLockfileEntry(entries.map((e) => e.name));
  const lockfileData = lockfileEntry
    ? parseLockfile(lockfileEntry.name, decodeEntry(entries, lockfileEntry.name))
    : { format: "none" as const, packages: [] as LockPkg[], rootDeps: [] as string[] };

  const lockVersions = new Map(
    lockfileData.packages.filter((p) => p.version).map((p) => [p.name, p.version]),
  );
  for (const pkg of packages) {
    pkg.version = pkg.version ?? lockVersions.get(pkg.fullName);
  }

  const graph: DependencyGraph = {
    appToPkg: {},
    pkgToSubPkg: {},
  };
  const appName = declaredDeps.name ?? input.sourceName.replace(/\.zip$/i, "");
  if (lockfileData.rootDeps.length > 0) {
    graph.appToPkg[appName] = lockfileData.rootDeps;
  }
  for (const lockPkg of lockfileData.packages) {
    if (lockPkg.dependencies.length > 0) {
      graph.pkgToSubPkg[lockPkg.name] = lockPkg.dependencies;
    }
  }

  const report: BundleStateReport = {
    id: crypto.randomUUID(),
    sourceName: input.sourceName,
    generatedAt: new Date().toISOString(),
    assets,
    packages,
    declaredDeps: {
      dependencies: declaredDeps.dependencies,
      devDependencies: declaredDeps.devDependencies,
      peerDependencies: declaredDeps.peerDependencies,
    },
    lockfile: {
      format: lockfileEntry?.format ?? "none",
      packageCount: lockfileData.packages.length,
      rawName: lockfileEntry?.name ?? "",
    },
    graph,
    insights: computeInsights({ assets, packages, declaredDeps }),
  };

  return report;
}

function aggregatePackages(assets: Asset[], bundler: ReturnType<typeof detectBundler>): Package[] {
  const byFullName = new Map<string, Package>();
  for (const asset of assets) {
    for (const fullName of asset.usedModules) {
      let pkg = byFullName.get(fullName);
      if (!pkg) {
        const resolved = resolvePackageFromPath(fullName);
        pkg = {
          name: resolved?.name ?? fullName,
          scope: resolved?.scope,
          fullName,
          source: bundler,
          usedIn: [],
        };
        byFullName.set(fullName, pkg);
      }
      if (!pkg.usedIn.includes(asset.name)) pkg.usedIn.push(asset.name);
    }
  }
  return [...byFullName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function readDeclaredDeps(entries: ZipEntry[]): DeclaredDeps & { name?: string } {
  const entry = findRootEntry(entries, "package.json");
  if (!entry) {
    return { dependencies: {}, devDependencies: {}, peerDependencies: {} };
  }
  try {
    const parsed = JSON.parse(DECODER.decode(entry.bytes)) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return {
      name: parsed.name,
      dependencies: parsed.dependencies ?? {},
      devDependencies: parsed.devDependencies ?? {},
      peerDependencies: parsed.peerDependencies ?? {},
    };
  } catch {
    return { dependencies: {}, devDependencies: {}, peerDependencies: {} };
  }
}

function findRootEntry(entries: ZipEntry[], target: string): ZipEntry | null {
  let best: ZipEntry | null = null;
  for (const entry of entries) {
    if (!entry.name.endsWith(`/${target}`) && entry.name !== target) continue;
    if (!best || entry.name.length < best.name.length) best = entry;
  }
  return best;
}

function decodeEntry(entries: ZipEntry[], name: string): string {
  const entry = entries.find((e) => e.name === name);
  return entry ? DECODER.decode(entry.bytes) : "";
}
