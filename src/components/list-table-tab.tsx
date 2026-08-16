import { ListTable } from "./list-table";
import { FilterInput } from "./ui";
import type { BundleStateReport } from "@/lib/types";

/** List tab: expandable dependant table. Filterable. */
export function ListTableTab({
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
      <ListTable report={report} filter={filter} />
    </div>
  );
}
