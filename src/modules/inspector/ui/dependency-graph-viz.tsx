import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { layoutDependencyGraph } from "@/modules/inspector/lib/dep-graph-layout";
import type { BundleStateReport } from "@/utils/types";

/**
 * d3 force-directed view of the module import graph. Cycle members are
 * highlighted (rose) and cycle edges drawn in alert color; ordinary edges are
 * dimmed. Renders as an SVG sized to its container via a ResizeObserver.
 */
export function DependencyGraphViz({ report }: { report: BundleStateReport }) {
  const { width, height } = useMemo(() => ({ width: 720, height: 460 }), []);
  const layout = useMemo(
    () =>
      layoutDependencyGraph(
        report.moduleGraph?.nodes ?? [],
        report.moduleGraph?.edges ?? [],
        report.insights.circularDepGroups,
        width,
        height,
      ),
    [report, width, height],
  );

  if (layout.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
        <AlertTriangle size={28} aria-hidden />
        <p className="text-sm">No module graph available.</p>
        <p className="text-xs text-faint">
          Upload a bundle whose source maps carry sourcesContent.
        </p>
      </div>
    );
  }

  const pos = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label="Module import dependency graph"
    >
      {/* edges */}
      {layout.links.map((l, i) => {
        const s = pos.get(l.source);
        const t = pos.get(l.target);
        if (!s || !t) return null;
        return (
          <line
            key={i}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke={l.inCycle ? "var(--tint-rose-fg)" : "var(--edge-strong)"}
            strokeWidth={l.inCycle ? 2 : 1}
            opacity={l.inCycle ? 0.9 : 0.25}
          />
        );
      })}
      {/* nodes */}
      {layout.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`}>
          <circle
            r={n.inCycle ? 7 : 5}
            fill={n.inCycle ? "var(--tint-rose-fg)" : n.local ? "var(--accent)" : "var(--ink-soft)"}
            stroke={n.inCycle ? "var(--tint-rose-fg)" : "transparent"}
            strokeWidth={n.inCycle ? 2 : 0}
          />
          {(n.inCycle || n.local) && (
            <text x={8} y={3} fontSize={9} className="fill-ink" style={{ fontFamily: "monospace" }}>
              {n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
