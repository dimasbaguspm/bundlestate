import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Treemap } from "@/components/treemap";
import { FilterInput } from "@/components/ui";
import type { BundleStateReport } from "@/utils/types";

/** Treemap tab: responsive package-size treemap, filterable. */
export function TreemapTab() {
  const report = useOutletContext<BundleStateReport>();
  const [filter, setFilter] = useState("");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <FilterInput value={filter} onChange={setFilter} placeholder="Filter packages…" />
      <div className="min-h-0 flex-1">
        <Treemap report={report} filterQuery={filter} className="h-full w-full" />
      </div>
    </div>
  );
}
