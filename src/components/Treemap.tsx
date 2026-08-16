import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { PackageSearch } from "lucide-react";
import { layoutTreemap } from "@/lib/treemap";
import type { BundleStateReport } from "@/lib/types";

const PALETTE = ["#1d2f22", "#27402c", "#335337", "#416544", "#52795a", "#c9a84c", "#e2b85c"];
const ASSET_STROKE = "rgba(0,0,0,0.30)";
const LABEL_FILL = "#eef5ef";

/**
 * Responsive D3 treemap rendered as an SVG that fills its container. Leaves
 * (packages) are sized proportionally to their bytes, so a bigger package
 * occupies a bigger area. Uses a ResizeObserver so it re-lays-out on any
 * resize or rotate. Filterable by package name.
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
      <div ref={ref} className={clsx("flex flex-col items-center justify-center gap-2 text-dim", className)}>
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

  return (
    <div ref={ref} className={clsx("min-h-0 w-full", className)} aria-label="Package size treemap">
      {size.w > 0 && (
        <svg width={size.w} height={size.h} role="img" aria-label="Package size treemap" className="block">
          {rects.map((r, i) =>
            r.isPackage ? (
              <g key={i}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={r.fullName ? colors.get(r.fullName) : "#27402c"}
                  rx={1}
                />
                {r.width > 36 && r.height > 16 && (
                  <text x={r.x + 3} y={r.y + Math.min(13, r.height / 2)} fill={LABEL_FILL} fontSize={10} className="select-none">
                    {r.name}
                  </text>
                )}
              </g>
            ) : (
              <rect
                key={i}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill="transparent"
                stroke={ASSET_STROKE}
                strokeWidth={1}
              />
            ),
          )}
        </svg>
      )}
    </div>
  );
}
