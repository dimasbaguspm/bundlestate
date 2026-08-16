import { AlertTriangle, FileArchive, Layers } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { BundleStateReport } from "@/lib/types";
import { Badge, Card } from "./ui";
import { Treemap } from "./Treemap";

const ENTROPY = new TextEncoder();

function ratioPercent(report: BundleStateReport): string {
  if (report.insights.gzipRatio === null) return "—";
  return `${(report.insights.gzipRatio * 100).toFixed(1)}%`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-xl text-ink">{value}</p>
    </Card>
  );
}

export function ReportPanel({ report }: { report: BundleStateReport }) {
  const pkgCount = report.packages.length;
  const pkgBytes = ENTROPY.encode(JSON.stringify(report)).byteLength;

  return (
    <section className="space-y-4" aria-label={`Report for ${report.sourceName}`}>
      <div className="flex flex-wrap items-center gap-2">
        <FileArchive size={16} className="text-ink" aria-hidden />
        <h2 className="font-mono text-base font-semibold text-ink">{report.sourceName}</h2>
        <Badge tone="accent">{report.assets.length} assets</Badge>
        <Badge>{pkgCount} shipped packages</Badge>
        <Badge tone={report.lockfile.format === "none" ? "danger" : "neutral"}>
          {report.lockfile.format === "none" ? "no lockfile" : report.lockfile.format}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total size" value={formatBytes(report.insights.totalSizeBytes)} />
        <Stat
          label="Gzip"
          value={
            report.insights.totalGzipBytes === null
              ? "—"
              : formatBytes(report.insights.totalGzipBytes)
          }
        />
        <Stat label="Gzip ratio" value={ratioPercent(report)} />
        <Stat
          label="Unused declared deps"
          value={String(report.insights.unusedDeclaredDeps.length)}
        />
      </div>

      {report.insights.unusedDeclaredDeps.length > 0 && (
        <Card className="border-danger/40">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-danger">Dependency drift detected</p>
              <p className="text-muted">
                Declared but never shipped:{" "}
                <span className="font-mono text-text">
                  {report.insights.unusedDeclaredDeps.join(", ")}
                </span>
              </p>
              <p className="text-xs text-muted">
                Serialized report ≈ {formatBytes(pkgBytes)} — plain object, no serialization issues.
              </p>
            </div>
          </div>
        </Card>
      )}

      {report.assets.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-ink" aria-hidden />
            <h3 className="text-sm font-medium">Bundle treemap</h3>
          </div>
          <Treemap report={report} />
        </Card>
      )}

      {report.packages.length > 0 && (
        <Card className="space-y-2">
          <h3 className="text-sm font-medium">Shipped packages</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4 font-medium">Package</th>
                  <th className="py-2 pr-4 font-medium">Version</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 font-medium">Used in</th>
                </tr>
              </thead>
              <tbody>
                {report.packages.map((pkg) => (
                  <tr key={pkg.fullName} className="border-b border-line/50 last:border-0">
                    <td className="py-2 pr-4 font-mono">{pkg.fullName}</td>
                    <td className="py-2 pr-4 font-mono text-muted">{pkg.version ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={pkg.source === "unknown" ? "neutral" : "accent"}>
                        {pkg.source}
                      </Badge>
                    </td>
                    <td className="py-2 text-muted">
                      {pkg.usedIn.length} {pkg.usedIn.length === 1 ? "asset" : "assets"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
