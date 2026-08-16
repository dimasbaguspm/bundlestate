import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { FileArchive } from "lucide-react";
import { Spinner } from "@/components/ui";
import { loadReport } from "@/db";
import { useBundleStore } from "@/state/store";
import type { BundleStateReport } from "@/lib/types";

/**
 * Detail page at `/r/:reportId`. Prefers the in-memory zustand copy (fresh
 * analysis) and falls back to IndexedDB so a refresh shows the same report.
 * Unknown ids redirect home with a banner.
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

  if (missing) return <Navigate to="/" replace state={{ missingReport: reportId }} />;

  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-label="Loading report">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={`Report for ${report.sourceName}`}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-edge px-4 py-2">
        <FileArchive size={16} className="text-ink" aria-hidden />
        <h2 className="font-mono text-sm font-semibold text-ink">{report.sourceName}</h2>
        <span className="ml-auto text-xs text-faint">{report.assets.length} assets</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <p>viz goes here</p>
      </div>
    </div>
  );
}