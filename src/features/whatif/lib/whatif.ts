import { buildPackageSizes } from "@/lib/sizes";
import type { BundleStateReport } from "@/lib/types";

export interface WhatIfResult {
  /** Recomputed total raw bytes with the exclusions applied. */
  totalRaw: number;
  /** Recomputed total gzip bytes (null when any source gzip is unknown). */
  totalGzip: number | null;
  /** Per-package sizes with excluded packages removed. */
  packageSizes: { fullName: string; sizeBytes: number }[];
  /** Raw bytes removed versus the baseline. */
  savedRaw: number;
  /** Percentage of raw bytes removed (0..100). */
  savedPct: number;
  /** Number of excluded packages. */
  excludedCount: number;
}

export interface WhatIfInput {
  /** Package fullNames to treat as tree-shaken away. */
  excluded: Set<string>;
}

/**
 * "What-If" tree-shaking simulator (PRD §4.5.1). Given a set of packages to
 * exclude, recompute total raw/gzip entirely in memory without a rebuild.
 *
 * Model: each asset's bytes are split evenly across its `usedModules`. When a
 * module is excluded we drop its share of the asset; an asset with all modules
 * excluded contributes nothing. Gzip is interpolated by the same kept-ratio
 * (exact per-byte gzip isn't recoverable, but the proportion is faithful).
 */
export function simulateExclusions(report: BundleStateReport, excluded: Set<string>): WhatIfResult {
  const baselineRaw = report.assets.reduce((s, a) => s + a.sizeBytes, 0);
  const gzipKnown = report.assets.every((a) => a.gzipBytes !== null);

  let keptRaw = 0;
  let keptGzip: number | null = 0;
  for (const asset of report.assets) {
    const modules = asset.usedModules;
    if (modules.length === 0) {
      // unattributed asset — keep it whole (can't blame a package)
      keptRaw += asset.sizeBytes;
      if (asset.gzipBytes != null) keptGzip += asset.gzipBytes;
      continue;
    }
    const kept = modules.filter((m) => !excluded.has(m)).length;
    const ratio = kept / modules.length;
    keptRaw += asset.sizeBytes * ratio;
    if (asset.gzipBytes != null) keptGzip += asset.gzipBytes * ratio;
  }

  keptRaw = Math.round(keptRaw);
  keptGzip = gzipKnown ? Math.round(keptGzip) : null;

  const packageSizes = buildPackageSizes(report)
    .filter((p) => !excluded.has(p.fullName))
    .map((p) => ({ fullName: p.fullName, sizeBytes: p.sizeBytes }));

  const savedRaw = Math.max(0, baselineRaw - keptRaw);
  const savedPct = baselineRaw > 0 ? (savedRaw / baselineRaw) * 100 : 0;

  return {
    totalRaw: keptRaw,
    totalGzip: keptGzip,
    packageSizes,
    savedRaw,
    savedPct,
    excludedCount: excluded.size,
  };
}
