import { Treemap } from "./Treemap";
import { FilterInput } from "./ui";
import type { BundleStateReport } from "@/lib/types";

/** Treemap tab: filterable, zoomable package-size view. */
export function TreemapTab({
  report,
  filter,
  onFilter,
  onNodeClick,
  selectedFullName,
}: {
  report: BundleStateReport;
  filter: string;
  onFilter: (value: string) => void;
  onNodeClick?: (fullName: string) => void;
  selectedFullName?: string | null;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <FilterInput value={filter} onChange={onFilter} placeholder="Filter packages…" />
      <div className="min-h-0 flex-1">
        <Treemap
          report={report}
          filterQuery={filter}
          onNodeClick={onNodeClick}
          selectedFullName={selectedFullName}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
