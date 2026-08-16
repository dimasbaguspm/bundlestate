import { useMemo } from "react";
import { AlertTriangle, Boxes, GitBranch, X } from "lucide-react";
import { clsx } from "clsx";
import type { BundleStateReport, Package, VersionClash } from "@/lib/types";
import { findLineages } from "@/lib/lineage";
import { formatLineageChain, latestBadge, moduleDegrees, type ModuleIdMap } from "@/lib/inspector";
import { formatBytes } from "@/lib/format";
import { Badge } from "./ui";
import type { GraphSelection } from "./dependency-graph";

interface InspectorSidebarProps {
  report: BundleStateReport;
  /** Selected graph/treemap node, or null. */
  selection: GraphSelection | null;
  /** Show the insights summary (nothing selected). */
  insightsOpen: boolean;
  /** fullName → latest published npm version (checked so far). */
  versions: Record<string, string>;
  /** Version checks are still running. */
  checking: boolean;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 rounded-md border border-edge bg-well px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p className="truncate font-mono text-sm text-ink">{value}</p>
    </div>
  );
}

function InsightRow({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-dim">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

function VersionClashesList({ clashes }: { clashes: VersionClash[] }) {
  if (clashes.length === 0) return <p className="text-sm text-dim">No duplicate versions bundled.</p>;
  return (
    <ul className="space-y-2">
      {clashes.map((clash) => (
        <li key={clash.fullName} className="rounded-md border border-edge bg-well px-2 py-1.5">
          <p className="font-mono text-sm text-ink">{clash.fullName}</p>
          {clash.versions.map((v) => (
            <p key={v.version} className="mt-0.5 pl-2 text-xs text-dim">
              <span className="font-mono text-accent">v{v.version}</span>
              {v.importedBy.length > 0 && ` — imported by ${v.importedBy.join(", ")}`}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function PackageDetails({
  report,
  pkg,
  versions,
  checking,
}: {
  report: BundleStateReport;
  pkg: Package;
  versions: Record<string, string>;
  checking: boolean;
}) {
  const byId: ModuleIdMap = useMemo(
    () => new Map((report.moduleGraph?.nodes ?? []).map((n) => [n.id, n])),
    [report.moduleGraph],
  );
  const lineages = useMemo(() => {
    const graph = report.moduleGraph;
    const targets = graph?.pkgModules[pkg.fullName] ?? [];
    if (!graph || targets.length === 0) return null;
    return findLineages(graph, targets);
  }, [report.moduleGraph, pkg.fullName]);

  const badge = latestBadge(pkg.version, versions[pkg.fullName]);
  const shipped = pkg.usedIn.length > 0 ? pkg.usedIn : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          {pkg.version ? `v${pkg.version}` : "unknown version"}
        </Badge>
        {checking ? (
          <Badge tone="accent">checking·latest…</Badge>
        ) : badge ? (
          <Badge tone={badge.tone}>{badge.label}</Badge>
        ) : null}
      </div>

      {shipped && (
        <InsightRow icon={<Boxes size={13} aria-hidden />} title="Shipped in assets">
          <ul className="space-y-0.5">
            {shipped.map((asset) => (
              <li key={asset} className="truncate font-mono text-xs text-dim">
                {asset}
              </li>
            ))}
          </ul>
        </InsightRow>
      )}

      <InsightRow icon={<GitBranch size={13} aria-hidden />} title="Why is this here?">
        {lineages && lineages.chains.length > 0 ? (
          <ul className="space-y-2">
            {lineages.chains.map((chain, i) => (
              <li
                key={i}
                className="rounded-md border border-edge bg-well px-2 py-1.5 font-mono text-[11px] leading-relaxed text-dim"
              >
                {formatLineageChain(chain.modules, byId).join(" → ")}
              </li>
            ))}
          </ul>
        ) : report.insights.lineage.available ? (
          <p className="text-sm text-dim">No import path found from app code to this package.</p>
        ) : (
          <p className="text-sm text-dim">
            {report.insights.lineage.reason ??
              "Module graph unavailable — the source maps carried no source content."}
          </p>
        )}
      </InsightRow>
    </div>
  );
}

function ModuleDetails({
  report,
  id,
  pkg,
}: {
  report: BundleStateReport;
  id: string;
  pkg?: string;
}) {
  const degrees = useMemo(
    () => (report.moduleGraph ? moduleDegrees(report.moduleGraph, id) : null),
    [report.moduleGraph, id],
  );
  const node = useMemo(
    () => report.moduleGraph?.nodes.find((n) => n.id === id),
    [report.moduleGraph, id],
  );
  const owner = pkg ?? (node && !node.local ? node.pkg : undefined);

  return (
    <div className="space-y-4">
      <InsightRow title="Module path">
        <p className="break-all rounded-md border border-edge bg-well px-2 py-1.5 font-mono text-[11px] leading-relaxed text-dim">
          {id}
        </p>
      </InsightRow>
      <InsightRow title="Owning package">
        {owner ? (
          <Badge tone="accent">{owner}</Badge>
        ) : (
          <Badge tone="neutral">app code</Badge>
        )}
      </InsightRow>
      {degrees && (
        <InsightRow title="Position in graph">
          <div className="flex gap-2">
            <Stat label="Imported by" value={String(degrees.importedBy)} />
            <Stat label="Imports" value={String(degrees.imports)} />
          </div>
        </InsightRow>
      )}
    </div>
  );
}

export function InsightsSummary({ report }: { report: BundleStateReport }) {
  const insights = report.insights;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Total size" value={formatBytes(insights.totalSizeBytes)} />
        <Stat
          label="Gzip"
          value={insights.totalGzipBytes === null ? "—" : formatBytes(insights.totalGzipBytes)}
        />
        <Stat
          label="Gzip ratio"
          value={insights.gzipRatio === null ? "—" : `${(insights.gzipRatio * 100).toFixed(1)}%`}
        />
        <Stat label="Packages" value={String(report.packages.length)} />
      </div>

      <InsightRow title="Largest assets">
        <ul className="space-y-0.5">
          {insights.largestAssets.map((name) => (
            <li key={name} className="truncate font-mono text-xs text-dim">
              {name}
            </li>
          ))}
        </ul>
      </InsightRow>

      <InsightRow title={`Version clashes (${insights.versionClashes.length})`}>
        <VersionClashesList clashes={insights.versionClashes} />
      </InsightRow>

      <InsightRow title={`Import cycles (${insights.circularDepCount})`}>
        {insights.circularDepGroups.length === 0 ? (
          <p className="text-sm text-dim">No local import cycles detected.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {insights.circularDepGroups.slice(0, 3).map((group, i) => (
                <li key={i} className="truncate font-mono text-xs text-dim">
                  {group.join(" → ")}
                </li>
              ))}
            </ul>
            {insights.circularDepGroups.length > 3 && (
              <p className="text-xs text-faint">
                +{insights.circularDepGroups.length - 3} more group(s)
              </p>
            )}
          </>
        )}
      </InsightRow>

      <InsightRow icon={<AlertTriangle size={13} aria-hidden />} title="Unused declared deps">
        {insights.unusedDeclaredDeps.length === 0 ? (
          <p className="text-sm text-dim">Every declared dependency ships.</p>
        ) : (
          <p className="font-mono text-xs text-ink">
            {insights.unusedDeclaredDeps.join(", ")}
          </p>
        )}
      </InsightRow>
    </div>
  );
}

/**
 * Right-hand inspector drawer overlaying the canvas. Shows package/module
 * details for the selected node, or the report insights summary when opened
 * without a selection.
 */
export function InspectorSidebar({
  report,
  selection,
  insightsOpen,
  versions,
  checking,
  onClose,
}: InspectorSidebarProps) {
  const open = selection !== null || insightsOpen;

  let title = "Insights";
  let body: React.ReactNode;
  if (selection?.kind === "package") {
    const pkg = report.packages.find((p) => p.fullName === selection.id);
    title = selection.id;
    body = pkg ? (
      <PackageDetails report={report} pkg={pkg} versions={versions} checking={checking} />
    ) : (
      <p className="text-sm text-dim">This package is not part of the report.</p>
    );
  } else if (selection?.kind === "module") {
    title = selection.id.split("/").pop() ?? selection.id;
    body = <ModuleDetails report={report} id={selection.id} pkg={selection.pkg} />;
  } else {
    body = <InsightsSummary report={report} />;
  }

  return (
    <aside
      aria-label="Inspector"
      aria-hidden={!open}
      className={clsx(
        "absolute inset-y-0 right-0 z-20 w-full max-w-[340px] transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex h-full flex-col border-l border-edge bg-surface shadow-[var(--shadow)]">
        <header className="flex shrink-0 items-center gap-2 border-b border-edge bg-surface px-4 py-3">
          <h3 className="min-w-0 truncate font-mono text-sm font-semibold text-ink">{title}</h3>
          <button
            type="button"
            aria-label="Close inspector"
            onClick={onClose}
            className="ml-auto rounded p-1 text-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{body}</div>
      </div>
    </aside>
  );
}