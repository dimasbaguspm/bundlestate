import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import { runInspector, type RuleFinding, type Severity } from "@/utils/rules";
import { traceCycle } from "@/utils/cycles";
import { displayModuleId, type ModuleIdMap } from "@/modules/inspector/lib/inspector";
import { DependencyGraphViz } from "./dependency-graph-viz";
import type { BundleStateReport, ModuleNode } from "@/utils/types";

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

/** Inspector tab (PRD §4.3 + §4.4): anti-pattern findings, a dependency-graph
 * visualization, and a circular-dependency warning/flag (cycles folded in
 * from the old Cycles tab). */
export function InspectorTab() {
  const report = useOutletContext<BundleStateReport>();
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

  const cycles = report.insights.circularDepGroups;
  const hasGraph = !!report.moduleGraph?.hasContents;

  const edges = report.moduleGraph?.edges ?? [];
  const byId = useMemo(() => {
    const m = new Map<string, ModuleNode>();
    report.moduleGraph?.nodes.forEach((n) => m.set(n.id, n));
    return m as ModuleIdMap;
  }, [report]);

  const [selectedCycle, setSelectedCycle] = useState(0);
  const trace = useMemo(() => {
    if (cycles.length === 0) return [] as string[];
    const g = cycles[Math.min(selectedCycle, cycles.length - 1)];
    return traceCycle(g, edges);
  }, [cycles, selectedCycle, edges]);

  const counts = findings.reduce<Record<Severity, number>>((acc, f) => (acc[f.severity]++, acc), {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto p-2">
      {/* Cycle warning flag (prominent when cycles exist) */}
      {cycles.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--tint-rose-fg)] bg-[var(--tint-rose-bg)] px-3 py-2">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-[var(--tint-rose-fg)]"
            aria-hidden
          />
          <div>
            <div className="text-sm font-semibold text-[var(--tint-rose-fg)]">
              Circular dependencies detected
            </div>
            <div className="text-[12px] text-dim">
              {cycles.length} cycle{cycles.length > 1 ? "s" : ""} found among local modules. See the
              trace below.
            </div>
          </div>
        </div>
      ) : hasGraph ? (
        <div className="flex items-center gap-2 rounded-lg border border-edge bg-well px-3 py-2 text-[12px] text-dim">
          <ShieldCheck size={16} className="shrink-0 text-accent" aria-hidden />
          No circular dependencies — module imports are acyclic.
        </div>
      ) : null}

      {/* Dependency graph visualization */}
      <div className="rounded-lg border border-edge bg-well">
        <div className="flex items-center justify-between border-b border-edge px-3 py-1.5">
          <span className="text-[11px] uppercase tracking-wide text-dim">
            Import dependency graph
            {!report.moduleGraph?.hasContents && (
              <span className="ml-1 text-faint">(packages · no source maps)</span>
            )}
          </span>
          <span className="text-[11px] tabular-nums text-faint">
            {report.moduleGraph?.nodes.length ?? 0} module nodes · {edges.length} edges
          </span>
        </div>
        <div className="h-[460px] p-2">
          <DependencyGraphViz report={report} />
        </div>
      </div>

      {/* Cycle trace (folded from Cycles tab) */}
      {cycles.length > 0 && (
        <div className="rounded-lg border border-edge bg-well">
          <div className="flex flex-wrap items-center gap-2 border-b border-edge px-3 py-1.5">
            <span className="text-[11px] uppercase tracking-wide text-dim">Cycle trace</span>
            {cycles.map((g, i) => (
              <button
                key={i}
                type="button"
                className={`rounded-lg border px-2 py-0.5 text-xs ${i === selectedCycle ? "border-accent/60 bg-accent/10 text-accent" : "border-edge bg-surface-2 text-dim hover:text-ink"}`}
                onClick={() => setSelectedCycle(i)}
              >
                #{i + 1} · {g.length} nodes
              </button>
            ))}
          </div>
          <ol className="space-y-1 p-3">
            {trace.map((id, i) => {
              const isClose = i === trace.length - 1;
              return (
                <li key={`${id}-${i}`} className="flex items-center gap-2 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] text-dim">
                    {i + 1}
                  </span>
                  <span
                    className={isClose ? "font-semibold text-[var(--tint-rose-fg)]" : "text-ink"}
                  >
                    {displayModuleId(id, byId)}
                  </span>
                  {i < trace.length - 1 && <span className="text-faint">↓ imports</span>}
                  {isClose && <Badge tone="danger">closes the loop</Badge>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Anti-pattern findings */}
      <div className="rounded-lg border border-edge bg-well p-2">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-dim">
            Anti-pattern findings
          </span>
          {(["critical", "high", "medium", "low"] as Severity[])
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <Badge key={s} tone={SEV_TONE[s]}>
                {SEV_LABEL[s]} · {counts[s]}
              </Badge>
            ))}
          {findings.length === 0 && <span className="text-[11px] text-faint">none</span>}
        </div>
        {findings.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
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
        )}
      </div>
    </div>
  );
}
