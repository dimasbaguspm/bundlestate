import { SizeBars } from "./size-bars";
import { FilterInput } from "./ui";
import type { BundleStateReport } from "@/lib/types";

/** Sizes tab: ranked, proportional package bars. Filterable + clickable. */
export function SizeBarsTab({
  report,
  filter,
  onFilter,
  onNodeClick,
  selectedFullName,
}: {
  report: BundleStateReport;
  filter: string;
  onFilter: (value: string) => void;
  onNodeClick: (fullName: string) => void;
  selectedFullName?: string | null;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <FilterInput value={filter} onChange={onFilter} placeholder="Filter packages…" />
      <SizeBars
        report={report}
        filter={filter}
        selectedFullName={selectedFullName}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
