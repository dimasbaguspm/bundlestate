import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui";
import { runInspector, type RuleFinding, type Severity } from "@/lib/rules";
import type { BundleStateReport } from "@/lib/types";

const SEV_TONE: Record<Severity, "danger" | "accent" | "neutral" | "ok"> = {
  critical: "danger",
  high: "accent",
  medium: "neutral",
  low: "ok",
};

const SEV_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Anti-Pattern Inspector tab (PRD §4.3). */
export function InspectorTab({ report }: { report: BundleStateReport }) {
  const findings = useMemo(
    () =>
      runInspector({
        assets: report.assets,
        packages: report.packages,
        versionClashes: report.insights.versionClashes,
        circularDepGroups: report.insights.circularDepGroups,
      }),
    [report],
  );

  if (findings.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-dim">
        <AlertTriangle size={32} aria-hidden />
        <p className="text-sm">No anti-patterns detected.</p>
        <p className="text-xs text-faint">Upload a bundle with source maps for deeper analysis.</p>
      </div>
    );
  }

  const counts = findings.reduce<Record<Severity, number>>(
    (acc, f) => ((acc[f.severity]++), acc),
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-dim">Findings</span>
        {(["critical", "high", "medium", "low"] as Severity[])
          .filter((s) => counts[s] > 0)
          .map((s) => (
            <Badge key={s} tone={SEV_TONE[s]}>
              {SEV_LABEL[s]} · {counts[s]}
            </Badge>
          ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-well">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface-2 text-left text-[11px] uppercase tracking-wide text-dim">
            <tr>
              <th className="px-3 py-2 font-semibold">Rule</th>
              <th className="px-3 py-2 font-semibold">Severity</th>
              <th className="px-3 py-2 font-semibold">Issue</th>
              <th className="px-3 py-2 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f: RuleFinding, i) => (
              <tr key={`${f.rule}-${i}`} className="border-t border-edge hover:bg-surface-2">
                <td className="px-3 py-2 font-mono text-[12px] text-accent">{f.rule}</td>
                <td className="px-3 py-2">
                  <Badge tone={SEV_TONE[f.severity]}>{SEV_LABEL[f.severity]}</Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-ink">{f.title}</div>
                  <div className="mt-0.5 text-[12px] text-dim">{f.detail}</div>
                  {f.evidence && (
                    <pre className="mt-1 overflow-x-auto rounded bg-surface-2 px-2 py-1 font-mono text-[11px] text-faint">
                      {f.evidence}
                    </pre>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[12px] text-dim">{f.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
