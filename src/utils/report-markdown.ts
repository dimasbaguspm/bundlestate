import type { BundleStateReport } from "./types";
import { formatBytes } from "./format";
import { buildPackageSizes } from "./sizes";

/**
 * A copy-pasteable Markdown summary of bundle health, sized for a pull
 * request description: total size, gzip, the largest packages, duplicate
 * versions and unused declared deps.
 */
export function buildMarkdownReport(report: BundleStateReport): string {
  const lines: string[] = [];
  lines.push(`## Bundle report · ${report.sourceName}`);
  lines.push("");

  const gzip =
    report.insights.totalGzipBytes != null
      ? ` (${formatBytes(report.insights.totalGzipBytes)} gzip)`
      : "";
  lines.push(`- **Total size:** ${formatBytes(report.insights.totalSizeBytes)}${gzip}`);
  lines.push(`- **Assets:** ${report.assets.length} · **Packages:** ${report.packages.length}`);
  if (report.insights.gzipRatio != null) {
    lines.push(`- **Gzip ratio:** ${(report.insights.gzipRatio * 100).toFixed(1)}%`);
  }
  lines.push("");

  const top = buildPackageSizes(report).slice(0, 10);
  lines.push("### Largest packages");
  lines.push("");
  lines.push("| Package | Size |");
  lines.push("| --- | --- |");
  for (const s of top) lines.push(`| \`${s.fullName}\` | ${formatBytes(s.sizeBytes)} |`);
  lines.push("");

  if (report.insights.versionClashes.length > 0) {
    lines.push("### Duplicate packages");
    lines.push("");
    for (const clash of report.insights.versionClashes) {
      lines.push(
        `- **${clash.fullName}** ships ${clash.versions.map((v) => `\`${v.version}\``).join(", ")}`,
      );
    }
    lines.push("");
  }

  if (report.insights.unusedDeclaredDeps.length > 0) {
    lines.push("### Unused declared deps");
    lines.push("");
    for (const dep of report.insights.unusedDeclaredDeps) lines.push(`- \`${dep}\``);
    lines.push("");
  }

  if (report.insights.circularDepCount > 0) {
    lines.push(`### Circular imports: ${report.insights.circularDepCount}`);
    lines.push("");
  }

  return lines.join("\n");
}
