import { LineageTable } from "./lineage-table";
import { FilterInput } from "./ui";
import type { BundleStateReport } from "@/lib/types";

/** Lineage tab: expandable dependant table. Filterable + clickable. */
export function LineageTableTab({
  report,
  filter,
  onFilter,
  onSelect,
}: {
  report: BundleStateReport;
  filter: string;
  onFilter: (value: string) => void;
  onSelect: (fullName: string) => void;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <FilterInput value={filter} onChange={onFilter} placeholder="Filter packages…" />
      <LineageTable report={report} filter={filter} onSelect={onSelect} />
    </div>
  );
}
