import { buildPackageSizes } from "@/lib/sizes";
import type { BundleStateReport } from "@/lib/types";

export interface PackageDelta {
  fullName: string;
  /** bytes added (positive) or removed (negative) in `other`. */
  deltaBytes: number;
  status: "added" | "removed" | "grown" | "shrunk" | "unchanged";
}

export interface ReportDiff {
  baseName: string;
  otherName: string;
  totalRawDelta: number;
  totalGzipDelta: number | null;
  packages: PackageDelta[];
  /** Cycles present in `other` but not in `base`. */
  newCycles: string[][];
  /** Cycles present in `base` but resolved in `other`. */
  resolvedCycles: string[][];
  /** Summary counts. */
  addedCount: number;
  removedCount: number;
}

function cycleKey(group: string[]): string {
  return [...group].sort().join(" ");
}

/**
 * Diff two bundle reports (PRD §4.5.2): net byte growth, per-package
 * added/removed/grown/shrunk, and newly introduced or resolved circular
 * cycles. Both reports must already be normalized.
 */
export function diffReports(base: BundleStateReport, other: BundleStateReport): ReportDiff {
  const baseRaw = base.assets.reduce((s, a) => s + a.sizeBytes, 0);
  const otherRaw = other.assets.reduce((s, a) => s + a.sizeBytes, 0);
  const gz = (r: BundleStateReport) =>
    r.assets.every((a) => a.gzipBytes !== null)
      ? r.assets.reduce((s, a) => s + (a.gzipBytes ?? 0), 0)
      : null;
  const baseGz = gz(base);
  const otherGz = gz(other);

  const basePkgs = new Map(buildPackageSizes(base).map((p) => [p.fullName, p.sizeBytes]));
  const otherPkgs = new Map(buildPackageSizes(other).map((p) => [p.fullName, p.sizeBytes]));
  const allNames = new Set([...basePkgs.keys(), ...otherPkgs.keys()]);
  const packages: PackageDelta[] = [];
  let addedCount = 0;
  let removedCount = 0;

  for (const name of allNames) {
    const b = basePkgs.get(name);
    const o = otherPkgs.get(name);
    if (b != null && o == null) {
      packages.push({ fullName: name, deltaBytes: -b, status: "removed" });
      removedCount++;
    } else if (b == null && o != null) {
      packages.push({ fullName: name, deltaBytes: o, status: "added" });
      addedCount++;
    } else if (b != null && o != null) {
      const dB = o - b;
      const status: PackageDelta["status"] = dB > 0 ? "grown" : dB < 0 ? "shrunk" : "unchanged";
      if (dB !== 0) packages.push({ fullName: name, deltaBytes: dB, status });
    }
  }
  packages.sort(
    (a, b) => Math.abs(b.deltaBytes) - Math.abs(a.deltaBytes) || a.fullName.localeCompare(b.fullName),
  );

  const baseCycles = new Set(base.insights.circularDepGroups.map(cycleKey));
  const otherCycles = new Set(other.insights.circularDepGroups.map(cycleKey));
  const newCycles = other.insights.circularDepGroups.filter((g) => !baseCycles.has(cycleKey(g)));
  const resolvedCycles = base.insights.circularDepGroups.filter((g) => !otherCycles.has(cycleKey(g)));

  return {
    baseName: base.sourceName,
    otherName: other.sourceName,
    totalRawDelta: otherRaw - baseRaw,
    totalGzipDelta: baseGz != null && otherGz != null ? otherGz - baseGz : null,
    packages,
    newCycles,
    resolvedCycles,
    addedCount,
    removedCount,
  };
}
