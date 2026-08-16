import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { FileArchive } from "lucide-react";
import { clsx } from "clsx";
import { Badge, btn, btnActive, Spinner } from "@/components/ui";
import { TreemapTab } from "@/components/treemap-tab";
import { LineageTab } from "@/components/lineage-tab";
import { DependenciesTab } from "@/components/dependencies-tab";
import { InspectorSidebar } from "@/components/inspector-sidebar";
import type { GraphSelection } from "@/components/dependency-graph";
import { getVersions, loadReport, saveVersion } from "@/db";
import { createVersionsClient } from "@/workers/versions-client";
import { useBundleStore } from "@/state/store";
import type { BundleStateReport } from "@/lib/types";

type Tab = "treemap" | "lineage" | "dependencies";

/** One registry check (and cache hydration) per report id, even under StrictMode remounts. */
const versionChecksStarted = new Set<string>();

/**
 * Detail page at `/r/:reportId`. Prefers the in-memory zustand copy (fresh
 * analysis) and falls back to IndexedDB so a refresh shows the same report.
 * Unknown ids redirect home with a banner. Header holds three tabs —
 * Treemap / Lineage / Dependencies — each full width/height with its own
 * filter; the inspector sidebar overlays on the right.
 */
export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = id ?? "";
  const storeReport = useBundleStore((state) => state.reports[reportId]);
  const versions = useBundleStore((state) => state.versions);
  const [persisted, setPersisted] = useState<BundleStateReport | null | undefined>(undefined);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("treemap");
  const [treeFilter, setTreeFilter] = useState("");
  const [lineageFilter, setLineageFilter] = useState("");
  const [depsFilter, setDepsFilter] = useState("");
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [checkingVersions, setCheckingVersions] = useState(false);

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

  // Closes an open node selection when navigating between reports.
  useEffect(() => {
    setSelection(null);
  }, [reportId]);

  // Latest-version badges: hydrate the cache from IndexedDB, then run one
  // bounded check for the packages we have not seen before.
  useEffect(() => {
    if (!report || versionChecksStarted.has(report.id)) return;
    versionChecksStarted.add(report.id);

    void (async () => {
      const cached = await getVersions();
      useBundleStore.getState().setVersions(cached);

      const fresh = report.packages
        .map((p) => p.fullName)
        .filter((name) => !cached[name]);
      if (fresh.length === 0) return;

      setCheckingVersions(true);
      try {
        const client = createVersionsClient();
        try {
          const results = await client.checkVersions(fresh.map((fullName) => ({ fullName })));
          const updates: Record<string, string> = {};
          for (const result of results) {
            if (result.latest) {
              updates[result.fullName] = result.latest;
              void saveVersion(result.fullName, result.latest);
            }
          }
          useBundleStore.getState().setVersions(updates);
        } finally {
          await client.dispose();
        }
      } finally {
        setCheckingVersions(false);
      }
    })();
  }, [report]);

  const selectPackage = (fullName: string) => {
    setSelection({ kind: "package", id: fullName });
  };

  const showInGraph = (fullName: string) => {
    setSelection({ kind: "package", id: fullName });
    setLineageFilter(fullName);
    setTab("lineage");
  };

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
    { id: "lineage", label: "Lineage" },
    { id: "dependencies", label: "Dependencies" },
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
          <TreemapTab
            report={report}
            filter={treeFilter}
            onFilter={setTreeFilter}
            onNodeClick={selectPackage}
            selectedFullName={selection?.kind === "package" ? selection.id : null}
          />
        )}
        {tab === "lineage" && (
          <LineageTab
            report={report}
            filter={lineageFilter}
            onFilter={setLineageFilter}
            onNodeClick={(node) => {
              setSelection(node);
            }}
          />
        )}
        {tab === "dependencies" && (
          <DependenciesTab
            report={report}
            filter={depsFilter}
            onFilter={setDepsFilter}
            onShowInGraph={showInGraph}
          />
        )}
        <InspectorSidebar
          report={report}
          selection={selection}
          versions={versions}
          checking={checkingVersions}
          onClose={() => setSelection(null)}
        />
      </div>
    </div>
  );
}
