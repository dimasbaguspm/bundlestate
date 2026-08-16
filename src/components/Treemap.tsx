import * as echarts from "echarts";
import { useEffect, useRef } from "react";
import type { BundleStateReport } from "../lib/types";
import { buildTreemap } from "../lib/treemap";

const PALETTE = ["#142117", "#1d2f22", "#27402c", "#335337", "#416544", "#e2b85c", "#c9a84c"];

interface TreemapProps {
  report: BundleStateReport;
}

/**
 * Apache ECharts treemap of the bundle. Direct echarts usage (no
 * echarts-for-react): init once per report, resize via ResizeObserver.
 */
export function Treemap({ report }: TreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el);

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
          data: buildTreemap(report),
        },
      ],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [report]);

  return <div ref={containerRef} data-testid="treemap" className="h-[420px] w-full" />;
}
