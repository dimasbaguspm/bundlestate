import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AlertTriangle, ArrowRight, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { layoutDependencyGraph } from "@/modules/inspector/lib/dep-graph-layout";
import { buildPackageGraph } from "@/modules/inspector/lib/dependency-graph";
import type { BundleStateReport } from "@/utils/types";

export type GraphView = "file" | "flow";

interface PanState {
  k: number;
  x: number;
  y: number;
}

const BASE_W = 900;
const BASE_H = 560;
/** Hard cap so the synchronous force layout can never freeze a mobile tab. */
const FILE_NODE_CAP = 160;

/**
 * Import-flow visualization with two views:
 * - `file`: a force-directed graph where each node is a file/module and each
 *   directed edge is a JS `import` (arrowheads). Node count is capped so the
 *   layout stays responsive on mobile; a note shows when it's truncated.
 * - `flow`: an edge-to-edge list of directed imports (`a.js → b.js`) with no
 *   node "atoms" — the lightweight, mobile-safe way to read import flow and
 *   spot cycles (highlighted in rose).
 */
export function DependencyGraphViz({
  report,
  view = "file",
}: {
  report: BundleStateReport;
  view?: GraphView;
}) {
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
  }, [report.id, view]);

  const { nodes, links, totalNodes } = useMemo(() => {
    const modNodes = report.moduleGraph?.nodes ?? [];
    const modEdges = report.moduleGraph?.edges ?? [];
    const total = modNodes.length;
    let finalNodes = modNodes;
    let finalEdges = modEdges;
    if (modNodes.length > FILE_NODE_CAP) {
      // Keep the highest-degree nodes so the densest import hubs stay visible.
      const deg = new Map<string, number>();
      for (const [from, to] of modEdges) {
        deg.set(from, (deg.get(from) ?? 0) + 1);
        deg.set(to, (deg.get(to) ?? 0) + 1);
      }
      const top = new Set(
        [...modNodes]
          .sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0))
          .slice(0, FILE_NODE_CAP)
          .map((n) => n.id),
      );
      finalNodes = modNodes.filter((n) => top.has(n.id));
      const keep = new Set(finalNodes.map((n) => n.id));
      finalEdges = modEdges.filter(([f, t]) => keep.has(f) && keep.has(t));
    }
    if (finalNodes.length > 0) {
      const layout = layoutDependencyGraph(
        finalNodes.map((n) => ({
          id: n.id,
          local: n.pkg === undefined,
          pkg: n.pkg,
          version: n.version,
        })),
        finalEdges,
        report.insights.circularDepGroups,
        BASE_W,
        BASE_H,
      );
      return {
        nodes: layout.nodes,
        links: layout.links,
        totalNodes: total,
        edges: finalEdges,
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
    return {
      nodes: layout.nodes,
      links: layout.links,
      totalNodes: pkg.nodes.length,
      edges: pkg.edges,
    };
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

  if (view === "flow") {
    return <FlowList report={report} />;
  }

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
  const truncated = totalNodes > FILE_NODE_CAP;

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
        {truncated && (
          <span>
            showing {nodes.length}/{totalNodes}
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

/** Edge-to-edge directed import list — no node atoms, mobile-safe. */
function FlowList({ report }: { report: BundleStateReport }) {
  const edges = report.moduleGraph?.edges ?? [];
  const byId = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of report.moduleGraph?.nodes ?? []) {
      const parts = n.id.split("/");
      m.set(n.id, parts[parts.length - 1] || n.id);
    }
    return m;
  }, [report]);
  const cycleEdges = useMemo(() => {
    const set = new Set<string>();
    for (const g of report.insights.circularDepGroups) {
      for (let i = 0; i < g.length; i++) {
        const a = g[i];
        const b = g[(i + 1) % g.length];
        set.add(`${a} ${b}`);
      }
    }
    return set;
  }, [report]);

  if (edges.length === 0) {
    const pkg = buildPackageGraph(report);
    if (pkg.edges.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-dim">
          No import edges detected.
        </div>
      );
    }
    return (
      <div className="h-full overflow-y-auto p-2">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-dim">
          Package imports (no source maps)
        </p>
        <ul className="space-y-1">
          {pkg.edges.map((e, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded border border-edge bg-well px-2 py-1 font-mono text-[12px]"
            >
              <span className="truncate text-ink">{e.source}</span>
              <ArrowRight size={13} className="shrink-0 text-dim" aria-hidden />
              <span className="truncate text-ink">{e.target}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-dim">
        Directed imports ({edges.length})
      </p>
      <ul className="space-y-1">
        {edges.map(([from, to], i) => {
          const inCycle = cycleEdges.has(`${from} ${to}`);
          return (
            <li
              key={i}
              className={`flex items-center gap-2 rounded border px-2 py-1 font-mono text-[12px] ${
                inCycle
                  ? "border-[var(--tint-rose-fg)] bg-[var(--tint-rose-bg)]"
                  : "border-edge bg-well"
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-ink">{byId.get(from) ?? from}</span>
              <ArrowRight
                size={13}
                className={inCycle ? "shrink-0 text-[var(--tint-rose-fg)]" : "shrink-0 text-dim"}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-ink">{byId.get(to) ?? to}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
