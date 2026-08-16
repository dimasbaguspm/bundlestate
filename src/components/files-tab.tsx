import { useMemo } from "react";
import { FileImage } from "lucide-react";
import { buildFileGroups } from "@/lib/files";
import { FilterInput } from "./ui";
import { formatBytes } from "@/lib/format";
import type { BundleStateReport } from "@/lib/types";

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

/** Files tab: static (non-JS/HTML) assets grouped by type. Filterable. */
export function FilesTab({
  report,
  filter,
  onFilter,
}: {
  report: BundleStateReport;
  filter: string;
  onFilter: (value: string) => void;
}) {
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = (report.files ?? []).filter(
      (f) => !q || f.path.toLowerCase().includes(q),
    );
    return buildFileGroups(all);
  }, [report, filter]);
  const maxBytes = groups[0]?.totalBytes ?? 1;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <FilterInput value={filter} onChange={onFilter} placeholder="Filter static files…" />
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-well">
        {groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
            <FileImage size={32} aria-hidden />
            <p className="text-sm">No static files.</p>
          </div>
        ) : (
          <div className="p-1">
            {groups.map((group) => (
              <div key={group.type} className="mb-1">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">
                    {group.type}
                  </span>
                  <span className="text-[11px] tabular-nums text-faint">
                    {group.files.length} · {formatBytes(group.totalBytes)}
                  </span>
                </div>
                <div className="ml-2">
                  {group.files.map((f) => (
                    <div
                      key={f.path}
                      className="flex items-center gap-2 rounded px-2 py-1 hover:bg-surface-2"
                      title={f.path}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-mono text-[13px] text-ink">
                            {basename(f.path)}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-dim">
                            {formatBytes(f.sizeBytes)}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent/70"
                            style={{ width: `${Math.max(2, (f.sizeBytes / maxBytes) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
