import { useEffect, useRef, useState, useCallback } from "react";
import { clsx } from "clsx";
import { ZoomIn, ZoomOut, Maximize, PackageSearch } from "lucide-react";
import { layoutTreemap } from "@/modules/treemap/lib/treemap";
import type { BundleStateReport } from "@/utils/types";

const PALETTE = ["#1d2f22", "#27402c", "#335337", "#416544", "#52795a", "#c9a84c", "#e2b85c"];
const ASSET_FILL = "rgba(128,128,128,0.08)";
const ASSET_STROKE = "rgba(0,0,0,0.35)";
const LABEL_FILL = "#eef5ef";

interface PanState {
  k: number;
  x: number;
  y: number;
}

interface PointerTrack {
  [id: number]: { x: number; y: number };
}

/**
 * Responsive D3 treemap. The SVG element itself grows with the zoom level
 * (`width = w * k`, `height = h * k`) inside a scrollable container, so
 * zooming genuinely expands the rectangles and you pan/scroll to explore —
 * the content is never clipped. Supports wheel-zoom, one-finger drag pan,
 * and two-finger pinch-zoom (touch). Labels appear (and grow) once you zoom
 * in past a threshold, so detail is revealed as rectangles expand.
 */
export function Treemap({
  report,
  filterQuery,
  className,
}: {
  report: BundleStateReport;
  filterQuery?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [pan, setPan] = useState<PanState>({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const pointersRef = useRef<PointerTrack>({});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset zoom when the filter changes so results are framed.
  useEffect(() => {
    setPan({ k: 1, x: 0, y: 0 });
  }, [filterQuery]);

  const rects = layoutTreemap(report, size.w, size.h, filterQuery);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setPan((p) => {
      const k = Math.min(8, Math.max(0.5, p.k * factor));
      const x = cx - (cx - p.x) * (k / p.k);
      const y = cy - (cy - p.y) * (k / p.k);
      return { k, x, y };
    });
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || size.w === 0) return;
      const cx = e.clientX - rect.left + pan.x;
      const cy = e.clientY - rect.top + pan.y;
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, cx, cy);
    },
    [pan.x, pan.y, size.w, zoomAt],
  );

  // --- Pinch + one-finger pan (touch) -------------------------------------
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is best-effort; pinch/pan still works without it */
    }
    pointersRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    const pts = Object.values(pointersRef.current);
    if (pts.length === 2) {
      const [a, b] = pts;
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    } else {
      dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    }
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointersRef.current[e.pointerId]) {
      pointersRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    }
    const pts = Object.values(pointersRef.current);
    if (pts.length === 2 && pinchRef.current) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rect = ref.current?.getBoundingClientRect();
      const localCx = (rect ? cx - rect.left : cx) + pan.x;
      const localCy = (rect ? cy - rect.top : cy) + pan.y;
      const factor = dist / (pinchRef.current.dist || dist);
      pinchRef.current = { dist, cx, cy };
      zoomAt(factor, localCx, localCy);
      return;
    }
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      setPan((p) => ({ ...p, x: dragRef.current!.px + dx, y: dragRef.current!.py + dy }));
    }
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    delete pointersRef.current[e.pointerId];
    if (Object.keys(pointersRef.current).length < 2) pinchRef.current = null;
    if (Object.keys(pointersRef.current).length === 0) dragRef.current = null;
  };

  if (size.w > 0 && rects.length === 0) {
    return (
      <div
        ref={ref}
        className={clsx(
          "relative flex flex-col items-center justify-center gap-2 text-dim",
          className,
        )}
      >
        <PackageSearch size={32} aria-hidden />
        <p className="text-sm">No matching packages.</p>
      </div>
    );
  }

  const colors = new Map<string, string>();
  let ci = 0;
  for (const r of rects) {
    if (r.isPackage && r.fullName && !colors.has(r.fullName)) {
      colors.set(r.fullName, PALETTE[ci++ % PALETTE.length]);
    }
  }
  const assets = rects.filter((r) => !r.isPackage);
  const w = size.w * pan.k;
  const h = size.h * pan.k;
  // Reveal text detail once zoomed in; expand the label threshold with zoom.
  const zoom = pan.k;
  const pkgLabelMin = zoom > 1.4 ? 14 : 40;
  const fileLabelMin = zoom > 1.4 ? 16 : 48;

  return (
    <div
      ref={ref}
      className={clsx("relative min-h-0 w-full overflow-auto", className)}
      aria-label="Package size treemap"
    >
      {size.w > 0 && (
        <>
          <div className="sticky right-2 top-2 z-10 float-right ml-2 mt-2 flex gap-1">
            <button
              type="button"
              aria-label="Zoom in"
              className="rounded border border-edge bg-surface-2 p-1.5 text-ink hover:bg-well"
              onClick={() => zoomAt(1.25, w / 2, h / 2)}
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              className="rounded border border-edge bg-surface-2 p-1.5 text-ink hover:bg-well"
              onClick={() => zoomAt(1 / 1.25, w / 2, h / 2)}
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
            width={w}
            height={h}
            role="img"
            aria-label="Package size treemap"
            className="block touch-none select-none"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* asset (file) regions first */}
            {assets.map((r, i) => (
              <rect
                key={`a${i}`}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={ASSET_FILL}
                stroke={ASSET_STROKE}
                strokeWidth={1}
              />
            ))}
            {/* package leaves */}
            {rects.map((r, i) =>
              r.isPackage ? (
                <rect
                  key={`p${i}`}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={r.fullName ? colors.get(r.fullName) : "#27402c"}
                  rx={1}
                />
              ) : null,
            )}
            {/* package labels — shown when big enough, or once zoomed in */}
            {rects.map((r, i) =>
              r.isPackage && r.width > pkgLabelMin && r.height > 14 ? (
                <text
                  key={`l${i}`}
                  x={r.x + 3}
                  y={r.y + Math.min(13 * zoom, r.height / 2)}
                  fill={LABEL_FILL}
                  fontSize={10 * Math.min(zoom, 1.6)}
                  className="select-none pointer-events-none"
                >
                  {r.name}
                </text>
              ) : null,
            )}
            {/* file-name labels on top */}
            {assets.map((r, i) =>
              r.width > fileLabelMin && r.height > 18 ? (
                <text
                  key={`f${i}`}
                  x={r.x + 3}
                  y={r.y + 11 * Math.min(zoom, 1.6)}
                  fill={LABEL_FILL}
                  fontSize={9 * Math.min(zoom, 1.6)}
                  opacity={0.85}
                  className="select-none pointer-events-none"
                >
                  {fitText(r.name, r.width - 6)}
                </text>
              ) : null,
            )}
          </svg>
        </>
      )}
    </div>
  );
}

/** Truncate a label to fit within `max` px (approx, monospace 9px). */
function fitText(name: string, max: number): string {
  const approx = Math.max(1, Math.floor(max / 5.5));
  return name.length > approx ? `${name.slice(0, Math.max(1, approx - 1))}…` : name;
}
