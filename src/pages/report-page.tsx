import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { FileArchive } from "lucide-react";
import { clsx } from "clsx";
import { Badge, btn, btnActive, CopyButton, Spinner } from "@/components/ui";
import { TreemapTab } from "@/components/treemap-tab";
import { FilesTab } from "@/components/files-tab";
import { PreviewTab } from "@/components/preview-tab";
import { InspectorTab } from "@/components/inspector-tab";
import { WhatIfTab } from "@/components/whatif-tab";
import { DiffTab } from "@/components/diff-tab";
import { loadReport } from "@/db";
import { buildMarkdownReport } from "@/lib/reportMarkdown";
import { useBundleStore } from "@/state/store";
import type { BundleStateReport } from "@/lib/types";

type Tab = "treemap" | "files" | "preview" | "inspector" | "whatif" | "diff";

/**
 * Detail page at `/r/:reportId`. Prefers the in-memory zustand copy (fresh
 * analysis) and falls back to IndexedDB so a refresh shows the same report.
 * Unknown ids redirect home with a banner. Header holds three tabs —
 * Treemap / List / Files — each full width/height with its own filter, plus
 * a Copy button that generates a PR-ready Markdown report.
 */
export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = id ?? "";
  const storeReport = useBundleStore((state) => state.reports[reportId]);
  const [persisted, setPersisted] = useState<BundleStateReport | null | undefined>(undefined);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("treemap");
  const [treemapFilter, setTreemapFilter] = useState("");
  const [filesFilter, setFilesFilter] = useState("");

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

  const markdown = useMemo(() => (report ? buildMarkdownReport(report) : ""), [report]);

  if (missing) return <Navigate to="/" replace state={{ missingReport: reportId }} />;

  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-label="Loading report">
        <Spinner />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "treemap", label: "Treemap" },
    { id: "files", label: "Files" },
    { id: "preview", label: "Preview" },
    { id: "inspector", label: "Inspector" },
    { id: "whatif", label: "What-If" },
    { id: "diff", label: "Diff" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={`Report for ${report.sourceName}`}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-edge px-4 py-2">
        <FileArchive size={16} className="text-ink" aria-hidden />
        <h2 className="max-w-[20ch] truncate font-mono text-sm font-semibold text-ink">
          {report.sourceName}
        </h2>
        <Badge tone="accent">{report.assets.length} assets</Badge>
        <Badge tone="neutral">{report.packages.length} pkgs</Badge>
        <Badge tone="neutral">
          {report.insights.gzipRatio === null
            ? "gzip —"
            : `gzip ${(report.insights.gzipRatio * 100).toFixed(1)}%`}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <CopyButton value={markdown} label="Copy report" className="px-2.5 py-1 text-xs" />
          <div
            role="tablist"
            aria-label="Report views"
            className="flex items-center rounded-lg border border-edge bg-surface-2 p-0.5"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={clsx(btn, "px-2.5 py-1 text-xs", tab === t.id && btnActive)}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {tab === "treemap" && (
          <TreemapTab report={report} filter={treemapFilter} onFilter={setTreemapFilter} />
        )}
        {tab === "files" && (
          <FilesTab report={report} filter={filesFilter} onFilter={setFilesFilter} />
        )}
        {tab === "preview" && <PreviewTab report={report} />}
        {tab === "inspector" && <InspectorTab report={report} />}
        {tab === "whatif" && <WhatIfTab report={report} />}
        {tab === "diff" && <DiffTab report={report} />}
      </div>
    </div>
  );
}
