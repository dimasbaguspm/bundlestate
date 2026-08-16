import { Treemap } from "./Treemap";
import { FilterInput } from "./ui";
import type { BundleStateReport } from "@/lib/types";

/** Treemap tab: responsive package-size treemap, filterable. */
export function TreemapTab({
  report,
  filter,
  onFilter,
}: {
  report: BundleStateReport;
  filter: string;
  onFilter: (value: string) => void;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <FilterInput value={filter} onChange={onFilter} placeholder="Filter packages…" />
      <div className="min-h-0 flex-1">
        <Treemap report={report} filterQuery={filter} className="h-full w-full" />
      </div>
    </div>
  );
}
