import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge, btn, btnActive } from "@/components/ui";
import { simulateExclusions } from "@/lib/whatif";
import { buildPackageSizes } from "@/lib/sizes";
import { formatBytes } from "@/lib/format";
import type { BundleStateReport } from "@/lib/types";

/** What-If tree-shaking simulator (PRD §4.5.1). */
export function WhatIfTab({ report }: { report: BundleStateReport }) {
  const allPackages = useMemo(() => buildPackageSizes(report).map((p) => p.fullName), [report]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const toggle = (name: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const baselineRaw = report.assets.reduce((s, a) => s + a.sizeBytes, 0);
  const result = useMemo(() => simulateExclusions(report, excluded), [report, excluded]);

  const saved = result.savedRaw > 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-dim">What-If · exclude packages</span>
        {saved && (
          <Badge tone="ok">
            −{formatBytes(result.savedRaw)} ({result.savedPct.toFixed(1)}%)
          </Badge>
        )}
      </div>

      {/* Live recompute summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Baseline" value={formatBytes(baselineRaw)} />
        <Stat label="Simulated" value={formatBytes(result.totalRaw)} accent={saved} />
        <Stat
          label="Gzip (sim)"
          value={result.totalGzip != null ? formatBytes(result.totalGzip) : "—"}
        />
      </div>

      {/* Package toggles */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-well p-2">
        {allPackages.length === 0 ? (
          <p className="text-sm text-dim">No package-level data — upload a bundle with source maps.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allPackages.map((name) => {
              const on = excluded.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  className={`rounded-lg border px-2.5 py-1 text-xs ${on ? btnActive : btn}`}
                  onClick={() => toggle(name)}
                  aria-pressed={on}
                >
                  {on ? "✕ " : ""}
                  {name}
                </button>
              );
            })}
          </div>
        )}
        {excluded.size > 0 && (
          <button
            type="button"
            className={`mt-2 ${btn}`}
            onClick={() => setExcluded(new Set())}
          >
            Reset exclusions
          </button>
        )}
      </div>
      <p className="text-[11px] text-faint">
        <Sparkles size={12} className="mr-1 inline" aria-hidden />
        Off-main-thread estimate: each asset's bytes are split across its modules; excluded
        modules drop their share. No rebuild required.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-edge bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-dim">{label}</div>
      <div className={`mt-0.5 font-mono text-lg ${accent ? "text-[var(--tint-emerald-fg)]" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
