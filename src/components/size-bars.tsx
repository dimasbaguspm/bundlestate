import { useMemo } from "react";
import { clsx } from "clsx";
import { PackageSearch } from "lucide-react";
import { buildPackageSizes } from "@/lib/sizes";
import { formatBytes } from "@/lib/format";
import type { BundleStateReport } from "@/lib/types";

/**
 * Sizes view: a ranked, proportional bar list of every shipped package.
 * Bigger package = wider bar. Simple and readable on mobile and desktop.
 */
export function SizeBars({
  report,
  filter,
  selectedFullName,
  onNodeClick,
}: {
  report: BundleStateReport;
  filter: string;
  selectedFullName?: string | null;
  onNodeClick: (fullName: string) => void;
}) {
  const sizes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return buildPackageSizes(report).filter(
      (s) => !q || s.fullName.toLowerCase().includes(q),
    );
  }, [report, filter]);
  const max = sizes[0]?.sizeBytes ?? 1;

  if (sizes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
        <PackageSearch size={32} aria-hidden />
        <p className="text-sm">No matching packages.</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-0.5 p-2">
        {sizes.map((s) => (
          <button
            key={s.fullName}
            type="button"
            onClick={() => onNodeClick(s.fullName)}
            aria-label={`View ${s.fullName}`}
            className={clsx(
              "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2",
              selectedFullName === s.fullName && "bg-accent/10 ring-1 ring-accent/40",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-mono text-sm text-ink">{s.fullName}</span>
                <span className="shrink-0 text-xs tabular-nums text-dim">
                  {formatBytes(s.sizeBytes)}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(2, (s.sizeBytes / max) * 100)}%` }}
                />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
