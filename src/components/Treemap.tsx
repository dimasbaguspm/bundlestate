import * as echarts from "echarts";
import type { ECElementEvent } from "echarts";
import { useEffect, useMemo, useRef } from "react";
import { clsx } from "clsx";
import type { BundleStateReport } from "@/lib/types";
import { buildTreemap, highlightNode } from "@/lib/treemap";

const PALETTE = ["#142117", "#1d2f22", "#27402c", "#335337", "#416544", "#e2b85c", "#c9a84c"];

interface TreemapProps {
  report: BundleStateReport;
  /** Fired when a package (leaf) node is clicked. */
  onNodeClick?: (fullName: string) => void;
  /** Package highlighted while its inspector is open. */
  selectedFullName?: string | null;
  className?: string;
}

/**
 * Apache ECharts treemap of the bundle. Direct echarts usage (no
 * echarts-for-react): init once per report, resize via ResizeObserver.
 * Package leaves are clickable (inspector wiring); the selected package is
 * highlighted gold via a fresh data tree.
 */
export function Treemap({ report, onNodeClick, selectedFullName, className }: TreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clickRef = useRef(onNodeClick);
  clickRef.current = onNodeClick;

  const packageNames = useMemo(
    () => new Set(report.packages.map((p) => p.fullName)),
    [report],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el);

    const data = selectedFullName ? highlightNode(buildTreemap(report), selectedFullName) : buildTreemap(report);

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        formatter: (params: { name: string; value: number; data?: { tooltip?: string } }) =>
          params.data?.tooltip ?? `${params.name} — ${params.value.toLocaleString()} B`,
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: true, itemStyle: { color: "#142117", borderColor: "#1d2f22" } },
          label: {
            show: true,
            formatter: (params: { name: string }) => params.name,
            fontSize: 11,
            color: "#dbe7dc",
          },
          upperLabel: { show: true, height: 22, color: "#dbe7dc", fontSize: 11 },
          itemStyle: { borderColor: "#0a100c", borderWidth: 1, gapWidth: 1 },
          emphasis: { label: { color: "#0a100c" }, itemStyle: { color: "#eecd85" } },
          levels: [
            { itemStyle: { borderColor: "#0a100c", borderWidth: 2, gapWidth: 2 } },
            { color: PALETTE, itemStyle: { borderColor: "#0a100c", borderWidth: 1 } },
          ],
          data,
        },
      ],
    });

    const onClick = (params: ECElementEvent) => {
      const data = params.data as { name?: string } | undefined;
      const name = data?.name;
      if (name && packageNames.has(name)) clickRef.current?.(name);
    };
    chart.on("click", onClick);

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      chart.off("click", onClick as never);
      observer.disconnect();
      chart.dispose();
    };
  }, [report, selectedFullName, packageNames]);

  return (
    <div
      ref={containerRef}
      data-testid="treemap"
      className={clsx(className ?? "h-[420px] w-full", "min-h-0")}
    />
  );
}