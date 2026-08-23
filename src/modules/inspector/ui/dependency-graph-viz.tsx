import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AlertTriangle, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { layoutDependencyGraph } from "@/modules/inspector/lib/dep-graph-layout";
import { buildPackageGraph } from "@/modules/inspector/lib/dependency-graph";
import type { BundleStateReport } from "@/utils/types";

interface PanState {
  k: number;
  x: number;
  y: number;
}

const BASE_W = 900;
const BASE_H = 560;

/**
 * Import-flow graph. Each node is a file/module; each directed edge is a JS
 * `import` (`from → to`). Arrowheads show the direction, so a cycle like
 * `a.js → b.js → a.js` reads clearly. Source maps with `sourcesContent`
 * drive the file-level view; without them it falls back to the package graph
 * from the lockfile. Cycles are highlighted in rose with a legend. Wheel /
 * drag / buttons navigate; the SVG fills its container and scales up on
 * small screens so nodes and labels stay legible.
 */
export function DependencyGraphViz({ report }: { report: BundleStateReport }) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [pan, setPan] = useState<PanState>({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPan({ k: 1, x: 0, y: 0 });
  }, [report.id]);

  const { nodes, links, cycleCount } = useMemo(() => {
    const modNodes = report.moduleGraph?.nodes ?? [];
    const modEdges = report.moduleGraph?.edges ?? [];
    if (modNodes.length > 0) {
      const layout = layoutDependencyGraph(
        modNodes.map((n) => ({
          id: n.id,
          local: n.pkg === undefined,
          pkg: n.pkg,
          version: n.version,
        })),
        modEdges,
        report.insights.circularDepGroups,
        BASE_W,
        BASE_H,
      );
      return {
        nodes: layout.nodes,
        links: layout.links,
        cycleCount: report.insights.circularDepGroups.length,
      };
    }
    const pkg = buildPackageGraph(report);
    const layout = layoutDependencyGraph(
      pkg.nodes.map((n) => ({
        id: n.id,
        local: n.category === "app",
        pkg: n.fullName,
        version: n.version,
      })),
      pkg.edges.map((e) => [e.source, e.target] as [string, string]),
      [],
      BASE_W,
      BASE_H,
    );
    return { nodes: layout.nodes, links: layout.links, cycleCount: 0 };
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
  const radiusFor = (n: { inCycle: boolean; local: boolean }) => (n.inCycle ? 9 : n.local ? 7 : 6);

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

      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 rounded border border-edge bg-surface-2 px-2 py-1 text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[var(--accent)]" /> local file
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[var(--ink-soft)]" /> package
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[var(--tint-rose-fg)]" /> in cycle
        </span>
        {cycleCount > 0 && (
          <span className="text-[var(--tint-rose-fg)]">
            ↻ {cycleCount} circular import{cycleCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        width={size.w || BASE_W}
        height={size.h || BASE_H}
        viewBox={`0 0 ${Math.max(...nodes.map((n) => n.x ?? 0), BASE_W)} ${Math.max(...nodes.map((n) => n.y ?? 0), BASE_H)}`}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label="Import dependency graph (directed: file imports → dependency)"
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--edge-strong)" />
          </marker>
          <marker
            id="arrow-cycle"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--tint-rose-fg)" />
          </marker>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${pan.k})`}>
          {links.map((l, i) => {
            const s = pos.get(l.source);
            const t = pos.get(l.target);
            if (!s || !t) return null;
            const sr = radiusFor(s);
            const tr = radiusFor(t);
            const dx = t.x! - s.x!;
            const dy = t.y! - s.y!;
            const len = Math.hypot(dx, dy) || 1;
            // Pull the endpoints back to the circle edges so the arrowhead
            // lands on the target rim and the line starts at the source rim.
            const ux = dx / len;
            const uy = dy / len;
            const x1 = s.x! + ux * sr;
            const y1 = s.y! + uy * sr;
            const x2 = t.x! - ux * (tr + 3);
            const y2 = t.y! - uy * (tr + 3);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={l.inCycle ? "var(--tint-rose-fg)" : "var(--edge-strong)"}
                strokeWidth={l.inCycle ? 2 : 1}
                opacity={l.inCycle ? 0.95 : 0.5}
                markerEnd={l.inCycle ? "url(#arrow-cycle)" : "url(#arrow)"}
              />
            );
          })}
          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              <circle
                r={radiusFor(n)}
                fill={
                  n.inCycle ? "var(--tint-rose-fg)" : n.local ? "var(--accent)" : "var(--ink-soft)"
                }
                stroke={n.inCycle ? "var(--tint-rose-fg)" : "transparent"}
                strokeWidth={n.inCycle ? 2 : 0}
              />
              <text
                x={11}
                y={4}
                fontSize={n.inCycle || n.local ? 11 : 10}
                className="fill-ink"
                style={{ fontFamily: "monospace" }}
              >
                {n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
