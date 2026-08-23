import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { PackageSearch } from "lucide-react";
import { layoutTreemap } from "@/modules/treemap/lib/treemap";
import type { BundleStateReport } from "@/utils/types";

const PALETTE = ["#1d2f22", "#27402c", "#335337", "#416544", "#52795a", "#c9a84c", "#e2b85c"];
const ASSET_FILL = "rgba(128,128,128,0.08)";
const ASSET_STROKE = "rgba(0,0,0,0.35)";
const LABEL_FILL = "#eef5ef";

/**
 * Responsive D3 treemap rendered as an SVG that fills its container. Leaves
 * (packages) are sized proportionally to their bytes, so a bigger package
 * occupies a bigger area. Packages are grouped inside their owning asset
 * (file), which is drawn as a faint region with a file-name label so you can
 * see which dependencies belong to which file. Uses a ResizeObserver to
 * re-layout on resize or rotate. Filterable by package name.
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rects = layoutTreemap(report, size.w, size.h, filterQuery);

  if (size.w > 0 && rects.length === 0) {
    return (
      <div
        ref={ref}
        className={clsx("flex flex-col items-center justify-center gap-2 text-dim", className)}
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

  return (
    <div ref={ref} className={clsx("min-h-0 w-full", className)} aria-label="Package size treemap">
      {size.w > 0 && (
        <svg
          width={size.w}
          height={size.h}
          role="img"
          aria-label="Package size treemap"
          className="block"
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
          {/* package labels (big enough leaves) */}
          {rects.map((r, i) =>
            r.isPackage && r.width > 40 && r.height > 16 ? (
              <text
                key={`l${i}`}
                x={r.x + 3}
                y={r.y + Math.min(13, r.height / 2)}
                fill={LABEL_FILL}
                fontSize={10}
                className="select-none pointer-events-none"
              >
                {r.name}
              </text>
            ) : null,
          )}
          {/* file-name labels on top, so grouping is legible */}
          {assets.map((r, i) =>
            r.width > 48 && r.height > 20 ? (
              <text
                key={`f${i}`}
                x={r.x + 3}
                y={r.y + 11}
                fill={LABEL_FILL}
                fontSize={9}
                opacity={0.85}
                className="select-none pointer-events-none"
              >
                {fitText(r.name, r.width - 6)}
              </text>
            ) : null,
          )}
        </svg>
      )}
    </div>
  );
}

/** Trim a label to fit roughly within `maxPx` at 9px font. */
function fitText(label: string, maxPx: number): string {
  const approx = maxPx / 5.2; // ~5.2px per char at 9px mono-ish
  if (label.length <= approx) return label;
  const head = Math.max(4, Math.floor(approx / 2) - 1);
  return `${label.slice(0, head)}…${label.slice(-4)}`;
}
