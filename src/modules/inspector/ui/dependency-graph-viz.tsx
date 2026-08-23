import { useMemo, useRef, useState, useCallback } from "react";
import { AlertTriangle, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { layoutDependencyGraph } from "@/modules/inspector/lib/dep-graph-layout";
import { buildPackageGraph } from "@/modules/inspector/lib/dependency-graph";
import type { BundleStateReport } from "@/utils/types";

interface PanState {
  k: number;
  x: number;
  y: number;
}

const BASE_W = 720;
const BASE_H = 460;

/**
 * d3 force-directed view of the module import graph (or, when source maps
 * lack sourcesContent, the package-level dependency graph derived from the
 * lockfile). Cycle members are highlighted (rose) and cycle edges drawn in
 * alert color; ordinary edges are dimmed. Supports wheel-zoom (to cursor),
 * drag-to-pan, and zoom buttons, so large graphs stay navigable.
 */
export function DependencyGraphViz({ report }: { report: BundleStateReport }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState<PanState>({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const { nodes, links, mode } = useMemo(() => {
    const modNodes = report.moduleGraph?.nodes ?? [];
    const modEdges = report.moduleGraph?.edges ?? [];
    if (modNodes.length > 0) {
      const layout = layoutDependencyGraph(
        modNodes,
        modEdges,
        report.insights.circularDepGroups,
        BASE_W,
        BASE_H,
      );
      return { nodes: layout.nodes, links: layout.links, mode: "module" as const };
    }
    // Fallback: package-level graph from the lockfile (always available).
    const pkg = buildPackageGraph(report);
    const layout = layoutDependencyGraph(
      pkg.nodes.map((n) => ({
        id: n.id,
        local: n.category === "app",
        pkg: n.pkg,
        version: n.version,
      })),
      pkg.edges.map((e) => [e.source, e.target] as [string, string]),
      [],
      BASE_W,
      BASE_H,
    );
    return { nodes: layout.nodes, links: layout.links, mode: "package" as const };
  }, [report]);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setPan((p) => {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k = Math.min(4, Math.max(0.4, p.k * factor));
      // Keep the point under the cursor fixed.
      const x = mx - ((mx - p.x) * k) / p.k;
      const y = my - ((my - p.y) * k) / p.k;
      return { k, x, y };
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan((p) => ({ ...p, x: dragRef.current!.px + dx, y: dragRef.current!.py + dy }));
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  if (nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
        <AlertTriangle size={28} aria-hidden />
        <p className="text-sm">No dependency graph available.</p>
        <p className="text-xs text-faint">
          Upload a bundle with source maps or a lockfile to see module/package integration.
        </p>
      </div>
    );
  }

  const pos = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          type="button"
          aria-label="Zoom in"
          className="rounded border border-edge bg-surface-2 p-1.5 text-ink hover:bg-well"
          onClick={() => setPan((p) => ({ ...p, k: Math.min(4, p.k * 1.2) }))}
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="rounded border border-edge bg-surface-2 p-1.5 text-ink hover:bg-well"
          onClick={() => setPan((p) => ({ ...p, k: Math.max(0.4, p.k / 1.2) }))}
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          aria-label="Reset view"
          className="rounded border border-edge bg-surface-2 p-1.5 text-ink hover:bg-well"
          onClick={() => setPan({ k: 1, x: 0, y: 0 })}
        >
          <Maximize size={14} />
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BASE_W} ${BASE_H}`}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={`${mode === "module" ? "Module" : "Package"} import dependency graph`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${pan.k})`}>
          {links.map((l, i) => {
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
          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              <circle
                r={n.inCycle ? 7 : 5}
                fill={
                  n.inCycle ? "var(--tint-rose-fg)" : n.local ? "var(--accent)" : "var(--ink-soft)"
                }
                stroke={n.inCycle ? "var(--tint-rose-fg)" : "transparent"}
                strokeWidth={n.inCycle ? 2 : 0}
              />
              {(n.inCycle || n.local) && (
                <text
                  x={8}
                  y={3}
                  fontSize={9}
                  className="fill-ink"
                  style={{ fontFamily: "monospace" }}
                >
                  {n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label}
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
