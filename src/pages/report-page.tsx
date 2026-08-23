import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { FileArchive } from "lucide-react";
import { clsx } from "clsx";
import { Badge, btn, btnActive, CopyButton, Spinner } from "@/components/ui";
import { loadReport } from "@/db";
import { buildMarkdownReport } from "@/utils/report-markdown";
import { useBundleStore } from "@/core/stores/store";
import type { BundleStateReport } from "@/utils/types";

/** Context the tab routes consume. */
export type ReportContext = BundleStateReport;

/**
 * Detail page at `/r/:reportId`. Prefers the in-memory zustand copy (fresh
 * analysis) and falls back to IndexedDB so a refresh shows the same report.
 * Unknown ids redirect home with a banner. The header holds the view tabs as
 * real routes (`/r/:id/:tab`), so each tab is deep-linkable and the browser
 * back/forward buttons work. A Copy button generates a PR-ready Markdown
 * report. Tabs receive the resolved report through the Outlet context.
 */
export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = id ?? "";
  const storeReport = useBundleStore((state) => state.reports[reportId]);
  const [persisted, setPersisted] = useState<BundleStateReport | null | undefined>(undefined);
  const [missing, setMissing] = useState(false);

  // Resolve the report: store copy first, then IndexedDB.
  useEffect(() => {
    if (storeReport) {
      setPersisted(undefined);
      return;
    }
    let cancelled = false;
    void loadReport(reportId).then((loaded) => {
      if (cancelled) return;
      if (loaded) setPersisted(loaded);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reportId, storeReport]);

  const report = storeReport ?? persisted;

  useEffect(() => {
    if (report) useBundleStore.getState().setActiveReport(report.id);
  }, [report]);

  const markdown = report ? buildMarkdownReport(report) : "";

  if (missing) return <Navigate to="/" replace state={{ missingReport: reportId }} />;

  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-label="Loading report">
        <Spinner />
      </div>
    );
  }

  const tabs = [
    { id: "treemap", label: "Treemap" },
    { id: "files", label: "Files" },
    { id: "preview", label: "Preview" },
    { id: "inspector", label: "Inspector" },
    { id: "diff", label: "Diff" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={`Report for ${report.sourceName}`}>
      <div className="flex flex-col gap-2 border-b border-edge px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileArchive size={16} className="shrink-0 text-ink" aria-hidden />
          <h2 className="max-w-[24ch] truncate font-mono text-sm font-semibold text-ink">
            {report.sourceName}
          </h2>
          <Badge tone="accent">{report.assets.length} assets</Badge>
          <Badge tone="neutral">{report.packages.length} pkgs</Badge>
          <Badge tone="neutral">
            {report.insights.gzipRatio === null
              ? "gzip —"
              : `gzip ${(report.insights.gzipRatio * 100).toFixed(1)}%`}
          </Badge>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <CopyButton value={markdown} label="Copy report" className="px-2.5 py-1 text-xs" />
          <nav
            aria-label="Report views"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border border-edge bg-surface-2 p-0.5 sm:flex-none"
          >
            {tabs.map((t) => (
              <NavLink
                key={t.id}
                to={t.id}
                role="tab"
                className={({ isActive }) =>
                  clsx(
                    btn,
                    "whitespace-nowrap px-2.5 py-1.5 text-xs min-h-[36px] min-w-[44px] flex-1 sm:flex-none",
                    isActive && btnActive,
                  )
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Outlet context={report} />
      </div>
    </div>
  );
}
