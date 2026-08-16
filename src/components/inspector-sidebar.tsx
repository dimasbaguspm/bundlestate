import { useMemo } from "react";
import { Boxes, GitBranch, X } from "lucide-react";
import { clsx } from "clsx";
import type { BundleStateReport, Package } from "@/lib/types";
import { findLineages } from "@/lib/lineage";
import { formatLineageChain, latestBadge, moduleDegrees, type ModuleIdMap } from "@/lib/inspector";
import { Badge } from "./ui";
import type { GraphSelection } from "./dependency-graph";

interface InspectorSidebarProps {
  report: BundleStateReport;
  /** Selected graph/treemap node, or null (sidebar hidden). */
  selection: GraphSelection | null;
  /** fullName → latest published npm version (checked so far). */
  versions: Record<string, string>;
  /** Version checks are still running. */
  checking: boolean;
  onClose: () => void;
}

/** Resolve a package selection id, handling version-qualified ids like `foo@2.0.0`. */
function findPackageById(report: BundleStateReport, id: string): Package | undefined {
  const at = id.lastIndexOf("@");
  if (at !== -1) {
    const base = id.slice(0, at);
    const version = id.slice(at + 1);
    const hit = report.packages.find((p) => p.fullName === base && String(p.version) === version);
    if (hit) return hit;
  }
  return report.packages.find((p) => p.fullName === id);
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

export function InspectorSidebar({
  report,
  selection,
  versions,
  checking,
  onClose,
}: InspectorSidebarProps) {
  const open = selection !== null;

  let title = "Inspector";
  let body: React.ReactNode = null;
  if (selection?.kind === "package") {
    const pkg = findPackageById(report, selection.id);
    title = selection.id;
    body = pkg ? (
      <PackageDetails report={report} pkg={pkg} versions={versions} checking={checking} />
    ) : (
      <p className="text-sm text-dim">This package is not part of the report.</p>
    );
  } else if (selection?.kind === "module") {
    title = selection.id.split("/").pop() ?? selection.id;
    body = <ModuleDetails report={report} id={selection.id} pkg={selection.pkg} />;
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