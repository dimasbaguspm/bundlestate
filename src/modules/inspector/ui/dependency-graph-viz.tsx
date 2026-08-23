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
 * Import dependency graph. When the analysis produced a module graph (source
 * maps with contents) the view shows individual files/modules and how they
 * import one another — "integration between each file". Without that, it
 * falls back to the package-level graph from the lockfile. Either way the
 * SVG fills its container, cycles are highlighted in rose, and wheel-zoom /
 * drag-pan / zoom buttons let you navigate large graphs.
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

  const { nodes, links, edgesPresent } = useMemo(() => {
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
        edgesPresent: modEdges.length > 0,
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
    return { nodes: layout.nodes, links: layout.links, edgesPresent: pkg.edges.length > 0 };
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
  // When there's only an isolated node (no edges), center it.
  const contentW = Math.max(...nodes.map((n) => n.x ?? 0), BASE_W);
  const contentH = Math.max(...nodes.map((n) => n.y ?? 0), BASE_H);

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
      {!edgesPresent && (
        <div className="absolute left-2 top-2 z-10 rounded border border-edge bg-surface-2 px-2 py-1 text-[11px] text-faint">
          No import edges detected
        </div>
      )}
      <svg
        ref={svgRef}
        width={size.w || BASE_W}
        height={size.h || BASE_H}
        viewBox={`0 0 ${contentW} ${contentH}`}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label="Import dependency graph"
        preserveAspectRatio="xMidYMid meet"
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
                opacity={l.inCycle ? 0.9 : 0.35}
              />
            );
          })}
          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              <circle
                r={n.inCycle ? 9 : n.local ? 7 : 6}
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
