import { DependencyGraph, type GraphSelection } from "./dependency-graph";
import { FilterInput } from "./ui";
import type { BundleStateReport } from "@/lib/types";

/** Lineage tab: the connected dependency graph, filterable. */
export function LineageTab({
  report,
  filter,
  onFilter,
  onNodeClick,
}: {
  report: BundleStateReport;
  filter: string;
  onFilter: (value: string) => void;
  onNodeClick: (selection: GraphSelection) => void;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <FilterInput value={filter} onChange={onFilter} placeholder="Filter packages…" />
      <div className="min-h-0 flex-1">
        <DependencyGraph report={report} filterQuery={filter} onNodeClick={onNodeClick} />
      </div>
    </div>
  );
}
