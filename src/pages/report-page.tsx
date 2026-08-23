import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { FileArchive, FilePlus2, Download } from "lucide-react";
import { clsx } from "clsx";
import { Badge, btn, btnActive, CopyButton, Spinner } from "@/components/ui";
import { Breadcrumb } from "@/components/breadcrumb";
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
  const json = report ? JSON.stringify(report, null, 2) : "";

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
  ];

  const headerLeft = (
    <>
      <FileArchive size={16} className="shrink-0 text-ink" aria-hidden />
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: report.sourceName }]} />
    </>
  );

  const headerActions = (
    <>
      <span className="hidden items-center gap-1 sm:flex">
        <Badge tone="accent">{report.assets.length} assets</Badge>
        <Badge tone="neutral">{report.packages.length} pkgs</Badge>
        <Badge tone="neutral">
          {report.insights.gzipRatio === null
            ? "gzip —"
            : `gzip ${(report.insights.gzipRatio * 100).toFixed(1)}%`}
        </Badge>
      </span>
      <CopyButton value={markdown} label="Copy report" className="px-2.5 py-1 text-xs" />
      <CopyButton
        value={json}
        label="Copy JSON"
        className="hidden px-2.5 py-1 text-xs sm:inline-flex"
      />
      <button
        type="button"
        onClick={() => {
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${report.sourceName.replace(/[^a-z0-9._-]/gi, "_")}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        className={clsx(btn, "px-2.5 py-1 text-xs")}
        title="Download report as JSON"
      >
        <Download size={13} className="sm:mr-1" aria-hidden />
        <span className="hidden sm:inline">Download</span>
      </button>
      <Link to="/" className={clsx(btn, "px-2.5 py-1 text-xs")} title="New analysis">
        <FilePlus2 size={13} className="sm:mr-1" aria-hidden />
        <span className="hidden sm:inline">New</span>
      </Link>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={`Report for ${report.sourceName}`}>
      <PageHeader left={headerLeft} actions={headerActions} />
      <nav
        aria-label="Report views"
        className="flex items-center gap-1 overflow-x-auto border-b border-edge bg-surface-2 px-2 py-1"
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Outlet context={report} />
      </div>
    </div>
  );
}
