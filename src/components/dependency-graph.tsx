import * as echarts from "echarts";
import type { ECElementEvent } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Workflow } from "lucide-react";
import { buildModuleSubgraph, buildPackageGraph } from "@/lib/dependencyGraph";
import type { BundleStateReport } from "@/lib/types";
import { Badge, btn } from "./ui";

export type GraphSelection =
  | { kind: "package"; id: string }
  | { kind: "module"; id: string; pkg?: string };

interface DependencyGraphProps {
  report: BundleStateReport;
  /** Fired for every package or module node click. */
  onNodeClick: (selection: GraphSelection) => void;
}

const CATEGORIES = [
  { name: "app", itemStyle: { color: "#c9a75c" } },
  { name: "package", itemStyle: { color: "#2d6a4f" } },
  { name: "module", itemStyle: { color: "#7dd3fc" } },
];

/**
 * Dependency graph (ECharts graph series, force layout): package-level by
 * default (aggregated from the module import graph, local modules collapsed
 * into an "app source" node; lockfile edges as fallback), drilling into a
 * package's own module subgraph on package click.
 */
export function DependencyGraph({ report, onNodeClick }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drilledPkg, setDrilledPkg] = useState<string | null>(null);
  const clickRef = useRef(onNodeClick);
  clickRef.current = onNodeClick;

  const packageData = useMemo(() => buildPackageGraph(report), [report]);
  const subgraph = useMemo(
    () => (drilledPkg ? buildModuleSubgraph(report, drilledPkg) : null),
    [report, drilledPkg],
  );

  // A drilled package with no module graph keeps the package view.
  const effective = drilledPkg && subgraph ? subgraph : null;
  const hasModuleData = effective ? true : packageData.hasModuleData;
  const nodes = effective?.nodes ?? packageData.nodes;
  const edges = effective?.edges ?? packageData.edges;
  const notice =
    !hasModuleData
      ? "No source content in the source maps — showing lockfile edges at package level only."
      : null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el);

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        formatter: (params: { data?: { name?: string; value?: number; pkg?: string } }) => {
          const d = params.data ?? {};
          const pkg = d.pkg ? ` — ${d.pkg}` : "";
          return `${d.name ?? ""}${pkg} — ${d.value ?? 0} edge(s)`;
        },
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          categories: CATEGORIES,
          force: { repulsion: 150, edgeLength: 70, gravity: 0.12, friction: 0.6 },
          edgeSymbol: ["none", "arrow"],
          label: { show: true, fontSize: 10, color: "#dbe7dc", position: "right" },
          itemStyle: { borderColor: "#0a100c", borderWidth: 1 },
          emphasis: { focus: "adjacency", label: { color: "#0a100c" } },
          symbolSize: (value: number) => 10 + Math.sqrt(Math.max(0, value)) * 3,
          lineStyle: { color: "#3e5648", width: 1.2, opacity: 0.75, curveness: 0.15 },
          data: nodes.map((n) => ({ id: n.id, name: n.name, value: n.value, category: n.category, pkg: n.pkg })),
          links: edges.map((e) => ({
            source: e.source,
            target: e.target,
            value: e.weight,
            lineStyle: { width: Math.min(8, 1 + Math.log2(e.weight + 1)) },
          })),
        },
      ],
    });

    const onClick = (params: ECElementEvent) => {
      const data = params.data as { id?: string; category?: string; pkg?: string } | undefined;
      if (!data?.id) return;
      if (data.category === "package") {
        clickRef.current?.({ kind: "package", id: data.id });
        if (report.moduleGraph && data.id !== drilledPkg) setDrilledPkg(data.id);
      } else if (data.category === "module") {
        clickRef.current?.({ kind: "module", id: data.id, pkg: data.pkg });
      }
    };
    chart.on("click", onClick);

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      chart.off("click", onClick as never);
      observer.disconnect();
      chart.dispose();
    };
  }, [nodes, edges, report, drilledPkg]);

  return (
    <div className="relative h-full w-full min-h-0" data-testid="dependency-graph">
      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <Badge tone="neutral">{notice}</Badge>
        </div>
      )}
      {drilledPkg && (
        <div className="absolute left-4 top-3 z-10 flex items-center gap-2">
          <button
            type="button"
            className={`${btn} px-2.5 py-1 text-xs`}
            onClick={() => setDrilledPkg(null)}
          >
            <ArrowLeft size={14} aria-hidden /> All packages
          </button>
          <Badge tone="accent">{drilledPkg}</Badge>
        </div>
      )}
      {nodes.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
          <Workflow size={32} aria-hidden />
          <p className="text-sm">No dependency relationships found for this bundle.</p>
        </div>
      ) : (
        <div ref={containerRef} className="h-full w-full" />
      )}
    </div>
  );
}