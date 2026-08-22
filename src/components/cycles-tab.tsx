import { useMemo, useState } from "react";
import { GitBranch } from "lucide-react";
import { Badge } from "@/components/ui";
import { traceCycle } from "@/lib/cycles";
import { displayModuleId, type ModuleIdMap } from "@/lib/inspector";
import type { BundleStateReport, ModuleNode } from "@/lib/types";

/** Circular dependency trace UI (PRD §4.4). */
export function CyclesTab({ report }: { report: BundleStateReport }) {
  const groups = report.insights.circularDepGroups;
  const [selected, setSelected] = useState(0);

  const byId = useMemo(() => {
    const m = new Map<string, ModuleNode>();
    report.moduleGraph?.nodes.forEach((n) => m.set(n.id, n));
    return m as ModuleIdMap;
  }, [report]);

  const edges = report.moduleGraph?.edges ?? [];

  const trace = useMemo(() => {
    if (groups.length === 0) return [];
    const g = groups[Math.min(selected, groups.length - 1)];
    return traceCycle(g, edges);
  }, [groups, selected, edges]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-dim">
        <GitBranch size={32} aria-hidden />
        <p className="text-sm">No circular dependencies detected.</p>
        <p className="text-xs text-faint">
          {report.moduleGraph?.hasContents
            ? "Module graph analyzed; imports are acyclic."
            : "Upload a bundle with source maps for module-level cycle detection."}
        </p>
      </div>
    );
  }

  const cycleSet = new Set(groups[Math.min(selected, groups.length - 1)]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      {/* Cycle selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-dim">Cycles</span>
        {groups.map((g, i) => (
          <button
            key={i}
            type="button"
            className={`rounded-lg border px-2.5 py-1 text-xs ${i === selected ? "border-accent/60 bg-accent/10 text-accent" : "border-edge bg-surface-2 text-dim hover:text-ink"}`}
            onClick={() => setSelected(i)}
          >
            #{i + 1} · {g.length} nodes
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1fr_280px]">
        {/* SVG: cycle highlighted, others dimmed (FR-4.1) */}
        <div className="min-h-0 overflow-auto rounded-lg border border-edge bg-well p-2">
          <CycleGraph group={cycleSet} edges={edges} byId={byId} />
        </div>

        {/* Step-by-step trace (FR-4.2) */}
        <div className="flex min-h-0 flex-col rounded-lg border border-edge bg-well">
          <div className="border-b border-edge px-3 py-1.5 text-[11px] uppercase tracking-wide text-dim">
            Step-by-step path trace
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <ol className="space-y-1">
              {trace.map((id, i) => {
                const isClose = i === trace.length - 1;
                const label = displayModuleId(id, byId);
                return (
                  <li key={`${id}-${i}`} className="flex items-center gap-2 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] text-dim">
                      {i + 1}
                    </span>
                    <span className={isClose ? "font-semibold text-[var(--tint-rose-fg)]" : "text-ink"}>
                      {label}
                    </span>
                    {i < trace.length - 1 && (
                      <span className="text-faint">↓ imports</span>
                    )}
                    {isClose && <Badge tone="danger">closes the loop</Badge>}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-[12px] text-dim">
              A circular import can cause uninitialized exports and break scope
              hoisting — the module imported first may read values not yet
              evaluated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact SVG node-link: cycle members highlighted, closing edge in alert color. */
function CycleGraph({
  group,
  edges,
  byId,
}: {
  group: Set<string>;
  edges: [string, string][];
  byId: ModuleIdMap;
}) {
  const ids = [...group];
  const n = ids.length;
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 50;
  const pos = new Map<string, { x: number; y: number }>();
  ids.forEach((id, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    pos.set(id, { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  });

  // edges that participate in the cycle (both endpoints in the group and adjacent in ring)
  const ring = ids;
  const cycleEdges: [string, string][] = [];
  for (let i = 0; i < ring.length; i++) {
    cycleEdges.push([ring[i], ring[(i + 1) % ring.length]]);
  }
  const isCycleEdge = (a: string, b: string) =>
    cycleEdges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block max-h-full w-full max-w-[360px]" role="img" aria-label="Circular dependency graph">
      {edges.map(([from, to], i) => {
        if (!pos.has(from) || !pos.has(to)) return null;
        const a = pos.get(from)!;
        const b = pos.get(to)!;
        const alert = isCycleEdge(from, to);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={alert ? "var(--tint-rose-fg)" : "var(--edge-strong)"}
            strokeWidth={alert ? 2.5 : 1}
            opacity={alert ? 1 : 0.35}
          />
        );
      })}
      {ids.map((id) => {
        const p = pos.get(id)!;
        return (
          <g key={id}>
            <circle cx={p.x} cy={p.y} r={7} fill="var(--tint-rose-fg)" />
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              className="fill-ink"
              style={{ fontSize: 9, fontFamily: "monospace" }}
            >
              {displayModuleId(id, byId).split("/").pop()?.slice(0, 14)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
