import { computeInsights } from "./insights";
import { detectLockfileEntry, parseLockfile, type LockPkg } from "./lockfile";
import { extractModuleGraph } from "./modulegraph";
import { collectStaticFiles } from "./files";
import { resolvePackageFromPath } from "./resolver";
import { usedModulesFromSources } from "./sourcemap";
import { toBase64 } from "./zip";
import type { Asset, BundleStateReport, DeclaredDeps, DependencyGraph, Package } from "./types";
import type { ZipEntry } from "./zip";

/** An asset as produced by the parse worker, before normalization. */
export interface RawAsset {
  name: string;
  sizeBytes: number;
  bytes: Uint8Array;
  /** Package-owned module paths from the asset's source map. */
  mapSources?: string[];
  /** Original source text aligned with `mapSources`, when the map carries it. */
  mapContents?: (string | undefined)[];
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

/** Coarse asset kind from the file extension. */
export function kindFromName(name: string): Asset["kind"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "js";
  return "other";
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
      rawBytes: toBase64(raw.bytes),
      kind: kindFromName(raw.name),
    })),
  );

  const packages = aggregatePackages(rawAssets, assets);

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

  // Module-level import graph — extracted from sourcesContent in this worker.
  const hasAnyContent = rawAssets.some((a) => (a.mapContents ?? []).length > 0);
  const moduleGraph = hasAnyContent ? extractModuleGraph(rawAssets) : undefined;
  const rawMapSources = rawAssets.map((a) => a.mapSources ?? []);

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
    moduleGraph,
    files: collectStaticFiles(entries),
    insights: computeInsights({ assets, packages, declaredDeps, rawMapSources, moduleGraph }),
  };

  return report;
}

function aggregatePackages(rawAssets: RawAsset[], assets: Asset[]): Package[] {
  const byFullName = new Map<string, Package>();
  // Walk the RAW source-map paths (not the pre-resolved usedModules): module
  // paths carry the package identity AND the pnpm virtual-store version.
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const raw = rawAssets[i];
    for (const source of raw.mapSources ?? []) {
      const resolved = resolvePackageFromPath(source);
      if (!resolved) continue;
      let pkg = byFullName.get(resolved.fullName);
      if (!pkg) {
        pkg = {
          name: resolved.name,
          scope: resolved.scope,
          fullName: resolved.fullName,
          version: resolved.version,
          source: resolved.source,
          usedIn: [],
        };
        byFullName.set(resolved.fullName, pkg);
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
