import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useParams } from "react-router-dom";
import { FileArchive, LayoutGrid, Files, Eye, GitGraph } from "lucide-react";
import { clsx } from "clsx";
import { CopyButton, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { loadReport } from "@/db";
import { buildMarkdownReport } from "@/utils/report-markdown";
import { useBundleStore } from "@/core/stores/store";
import type { BundleStateReport } from "@/utils/types";

/** Context the tab routes consume. */
export type ReportContext = BundleStateReport;

/**
 * Detail page at `/r/:reportId`. Prefers the in-memory zustand copy (fresh
 * analysis) and falls back to IndexedDB so a refresh shows the same report.
 * Unknown ids redirect home with a banner.
 *
 * Layout: a sticky PageHeader (breadcrumb + report actions) on top, the view
 * tabs directly beneath it, and the routed tab content filling the rest. Tabs
 * are real routes (`/r/:id/:tab`) so each is deep-linkable and the browser
 * back/forward buttons work. The resolved report is passed to tabs via the
 * Outlet context.
 */
export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = id ?? "";
  const storeReport = useBundleStore((state) => state.reports[reportId]);
  const [persisted, setPersisted] = useState<BundleStateReport | null | undefined>(undefined);
  const [missing, setMissing] = useState(false);

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
    { id: "treemap", label: "Treemap", icon: <LayoutGrid size={16} aria-hidden /> },
    { id: "files", label: "Files", icon: <Files size={16} aria-hidden /> },
    { id: "preview", label: "Preview", icon: <Eye size={16} aria-hidden /> },
    { id: "inspector", label: "Inspector", icon: <GitGraph size={16} aria-hidden /> },
  ];

  const headerLeft = (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <FileArchive size={15} className="shrink-0 text-ink" aria-hidden />
        <span className="truncate font-semibold text-ink" title={report.sourceName}>
          {report.sourceName}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-faint">
        <span>{((report.insights.totalSizeBytes ?? 0) / (1024 * 1024)).toFixed(2)} MB</span>
        <span>{report.assets.length} files</span>
        <span>{report.packages.length} dependencies</span>
      </div>
    </div>
  );

  const headerActions = (
    <CopyButton value={markdown} label="Copy report" className="px-2.5 py-1 text-xs" />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={`Report for ${report.sourceName}`}>
      <PageHeader left={headerLeft} actions={headerActions} />

      <div className="relative flex min-h-0 flex-1 flex-col pb-14 sm:pb-0">
        <Outlet context={report} />
      </div>

      <nav
        aria-label="Report views"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-edge bg-canvas/95 px-2 py-1.5 backdrop-blur sm:static sm:z-auto sm:border-t-0 sm:border-b sm:border-edge sm:bg-surface-2 sm:px-2 sm:py-1"
      >
        {tabs.map((t) => (
          <NavLink
            key={t.id}
            to={t.id}
            role="tab"
            className={({ isActive }) =>
              clsx(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-[11px] min-h-[44px] min-w-[44px] sm:flex-row sm:gap-1.5 sm:border-0 sm:px-2.5 sm:py-1.5 sm:text-xs",
                isActive
                  ? "border-accent/60 bg-accent/10 text-accent sm:border sm:border-accent/60"
                  : "border-transparent text-dim hover:bg-surface-2 hover:text-ink",
              )
            }
          >
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
