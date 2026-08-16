import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackageSearch, Search, Trash2 } from "lucide-react";
import { clearReports, deleteReport, listReports } from "@/db";
import { Drawer } from "./drawer";

interface ReportMeta {
  id: string;
  sourceName: string;
  generatedAt: string;
}

/** Slide-in history of analysed bundles, matching the syntaxdiff pattern. */
export function HistoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [query, setQuery] = useState("");

  const refresh = async () => setReports(await listReports());
  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => r.sourceName.toLowerCase().includes(q));
  }, [reports, query]);

  const handleOpen = (id: string) => {
    onClose();
    navigate(`/r/${id}`);
  };

  return (
    <Drawer open={open} title="History" onClose={onClose}>
      <div className="flex items-center gap-2 rounded-md border border-edge bg-well px-2 py-1.5">
        <Search className="size-4 shrink-0 text-faint" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search history"
          className="w-full bg-transparent text-sm text-ink placeholder-faint focus:outline-none"
        />
        {reports.length > 0 && (
          <button
            type="button"
            onClick={() => void clearReports().then(refresh)}
            className="shrink-0 text-xs text-[var(--tint-rose-fg)] transition-colors hover:bg-[var(--tint-rose-bg)]"
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <PackageSearch className="size-8 text-faint" aria-hidden />
          <p className="text-sm text-faint">No reports yet. Drop a bundle to see it here.</p>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-lg border border-edge bg-well px-2 py-2 transition-colors hover:border-edge-strong"
            >
              <button
                type="button"
                onClick={() => handleOpen(r.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <PackageSearch className="size-4 shrink-0 text-dim" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm font-medium text-ink">
                    {r.sourceName}
                  </span>
                  <span className="block text-xs text-faint">
                    {new Date(r.generatedAt).toLocaleString()}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void deleteReport(r.id).then(refresh)}
                aria-label="Delete"
                title="Delete"
                className="rounded p-1 text-dim transition-colors hover:bg-[var(--tint-rose-bg)] hover:text-[var(--tint-rose-fg)]"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
