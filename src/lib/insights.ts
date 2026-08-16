import type { Asset, DeclaredDeps, Insights, Package } from "./types";

export interface InsightsInput {
  assets: Asset[];
  packages: Package[];
  declaredDeps: DeclaredDeps;
}

const LARGEST_COUNT = 5;

/**
 * Skeleton insight engine: flags declared-but-unshipped dependencies,
 * computes aggregate gzip ratio and the largest assets. Kept deliberately
 * small for this iteration.
 */
export function computeInsights(input: InsightsInput): Insights {
  const shipped = new Set(input.packages.map((p) => p.fullName));

  const declared = new Map<string, string>();
  for (const [name, range] of [
    ...Object.entries(input.declaredDeps.dependencies),
    ...Object.entries(input.declaredDeps.devDependencies),
  ]) {
    declared.set(name, range);
  }
  const unusedDeclaredDeps = [...declared.keys()].filter((name) => !shipped.has(name)).sort();

  const totalSizeBytes = input.assets.reduce((sum, a) => sum + a.sizeBytes, 0);
  const gzipKnown = input.assets.every((a) => a.gzipBytes !== null);
  const totalGzipBytes = gzipKnown
    ? input.assets.reduce((sum, a) => sum + (a.gzipBytes ?? 0), 0)
    : null;
  const gzipRatio =
    totalSizeBytes > 0 && totalGzipBytes !== null ? totalGzipBytes / totalSizeBytes : null;

  const largestAssets = [...input.assets]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, LARGEST_COUNT)
    .map((a) => a.name);

  return {
    unusedDeclaredDeps,
    gzipRatio,
    largestAssets,
    totalSizeBytes,
    totalGzipBytes,
  };
}
