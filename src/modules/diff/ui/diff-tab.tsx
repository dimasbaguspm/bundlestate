import { useMemo, useEffect, useState } from "react";
import { GitCompare } from "lucide-react";
import { Badge } from "@/components/ui";
import { diffReports, type PackageDelta } from "@/modules/diff/lib/diff";
import { formatBytes } from "@/utils/format";
import { useBundleStore } from "@/core/stores/store";
import { loadAllReports } from "@/db";
import type { BundleStateReport } from "@/utils/types";

/** Multi-report diff (PRD §4.5.2). */
export function DiffTab({ report }: { report: BundleStateReport }) {
  const reportsMap = useBundleStore((s) => s.reports);
  const [dbReports, setDbReports] = useState<BundleStateReport[]>([]);

  useEffect(() => {
    let alive = true;
    void loadAllReports().then((all) => {
      if (alive) setDbReports(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  const storeReports = useMemo(
    () => Object.values(reportsMap).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    [reportsMap],
  );

  // Compare against any analyzed bundle (in-session uploads ∪ persisted DB).
  const others = useMemo(() => {
    const all = [...storeReports, ...dbReports];
    const byId = new Map<string, BundleStateReport>();
    for (const r of all) if (!byId.has(r.id)) byId.set(r.id, r);
    return [...byId.values()].filter((r) => r.id !== report.id);
  }, [storeReports, dbReports, report.id]);
  const [otherId, setOtherId] = useState<string | null>(null);

  // Auto-select the first available comparison target once reports load.
  useEffect(() => {
    if (otherId == null && others.length > 0) {
      setOtherId(others[0].id);
    } else if (otherId != null && !others.some((r) => r.id === otherId)) {
      setOtherId(others[0]?.id ?? null);
    }
  }, [others, otherId]);

  const other = others.find((r) => r.id === otherId) ?? null;
  const diff = useMemo(() => (other ? diffReports(report, other) : null), [report, other]);

  if (others.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-dim">
        <GitCompare size={32} aria-hidden />
        <p className="text-sm">No other report to compare.</p>
        <p className="text-xs text-faint">
          Analyze a second bundle (main vs feature) to see the delta.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-dim">Compare against</span>
        <select
          className="rounded-lg border border-edge bg-well px-2 py-1.5 text-sm text-ink"
          value={otherId ?? ""}
          onChange={(e) => setOtherId(e.target.value || null)}
        >
          {others.map((r) => (
            <option key={r.id} value={r.id}>
              {r.sourceName}
            </option>
          ))}
        </select>
      </div>

      {diff && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat
              label="Δ Raw"
              value={fmtSigned(diff.totalRawDelta)}
              tone={tone(diff.totalRawDelta)}
            />
            <Stat
              label="Δ Gzip"
              value={diff.totalGzipDelta != null ? fmtSigned(diff.totalGzipDelta) : "—"}
              tone={diff.totalGzipDelta != null ? tone(diff.totalGzipDelta) : "neutral"}
            />
            <Stat label="Packages" value={`+${diff.addedCount} / −${diff.removedCount}`} />
          </div>

          {diff.newCycles.length > 0 && (
            <div className="rounded-lg border border-[var(--tint-rose-bd)] bg-[var(--tint-rose-bg)] px-3 py-2 text-sm text-[var(--tint-rose-fg)]">
              ⚠ {diff.newCycles.length} new circular cycle(s) introduced.
            </div>
          )}
          {diff.resolvedCycles.length > 0 && (
            <div className="rounded-lg border border-[var(--tint-emerald-bd)] bg-[var(--tint-emerald-bg)] px-3 py-2 text-sm text-[var(--tint-emerald-fg)]">
              ✓ {diff.resolvedCycles.length} circular cycle(s) resolved.
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-well">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-[11px] uppercase tracking-wide text-dim">
                <tr>
                  <th className="px-3 py-2 font-semibold">Package</th>
                  <th className="px-3 py-2 font-semibold">Δ Bytes</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {diff.packages.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-dim">
                      No package-level differences.
                    </td>
                  </tr>
                ) : (
                  diff.packages.map((p: PackageDelta) => (
                    <tr key={p.fullName} className="border-t border-edge hover:bg-surface-2">
                      <td className="px-3 py-2 font-mono text-[12px] text-ink">{p.fullName}</td>
                      <td className="px-3 py-2 font-mono text-[12px]">{fmtSigned(p.deltaBytes)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={badgeTone(p.status)}>{p.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function tone(n: number): "ok" | "danger" | "neutral" {
  if (n < 0) return "ok"; // smaller is good
  if (n > 0) return "danger";
  return "neutral";
}
function badgeTone(s: PackageDelta["status"]): "ok" | "danger" | "accent" | "neutral" {
  switch (s) {
    case "added":
    case "grown":
      return "danger";
    case "removed":
    case "shrunk":
      return "ok";
    default:
      return "neutral";
  }
}
function fmtSigned(n: number): string {
  const s = formatBytes(Math.abs(n));
  return n === 0 ? "0 B" : n > 0 ? `+${s}` : `−${s}`;
}
function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "ok" | "danger" | "neutral";
}) {
  const color =
    tone === "ok"
      ? "text-[var(--tint-emerald-fg)]"
      : tone === "danger"
        ? "text-[var(--tint-rose-fg)]"
        : "text-ink";
  return (
    <div className="rounded-lg border border-edge bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-dim">{label}</div>
      <div className={`mt-0.5 font-mono text-lg ${color}`}>{value}</div>
    </div>
  );
}
