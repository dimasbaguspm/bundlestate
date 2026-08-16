import type { BundleStateReport } from "./types";

export interface PackageSize {
  fullName: string;
  sizeBytes: number;
}

/**
 * Approximate per-package shipped bytes: sum each package's per-asset share
 * (`asset.sizeBytes / usedModules.length`) across the assets that carry it.
 * Exact per-package bytes are not derivable from source maps alone, but the
 * ranking and proportions are a faithful picture of bloat. Sorted descending.
 */
export function buildPackageSizes(report: BundleStateReport): PackageSize[] {
  const sizes = new Map<string, number>();
  for (const asset of report.assets) {
    const modules = asset.usedModules;
    if (modules.length === 0) continue;
    const share = asset.sizeBytes / modules.length;
    for (const pkg of modules) {
      sizes.set(pkg, (sizes.get(pkg) ?? 0) + share);
    }
  }
  return [...sizes.entries()]
    .map(([fullName, sizeBytes]) => ({ fullName, sizeBytes: Math.round(sizeBytes) }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes || a.fullName.localeCompare(b.fullName));
}
