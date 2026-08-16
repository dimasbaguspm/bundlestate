import { useMemo, useState } from "react";
import { ChevronRight, Network } from "lucide-react";
import { clsx } from "clsx";
import { buildLineageTable, type LineageTreeNode } from "@/lib/lineageTable";
import type { BundleStateReport } from "@/lib/types";

function DependantRow({ node, depth }: { node: LineageTreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const label = node.isApp ? "app" : node.fullName;
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-surface-2"
        style={{ paddingLeft: depth * 16 + 6 }}
      >
        <button
          type="button"
          disabled={!hasChildren}
          onClick={() => hasChildren && setOpen((o) => !o)}
          aria-label={open ? "Collapse" : "Expand"}
          className="shrink-0 rounded p-0.5 text-dim transition-colors hover:bg-surface disabled:invisible"
        >
          <ChevronRight size={13} className={clsx("transition-transform", open && "rotate-90")} aria-hidden />
        </button>
        <span
          className={clsx(
            "min-w-0 flex-1 truncate font-mono text-[13px]",
            node.isApp ? "italic text-dim" : "text-ink",
          )}
        >
          {label}
        </span>
        {!node.isApp && node.version && (
          <span className="shrink-0 text-[11px] text-faint">v{node.version}</span>
        )}
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <DependantRow key={child.fullName} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Lineage view: a basic expandable table. Each row is a shipped package and
 * expanding it reveals who depends on it, transitively up to `app` — e.g.
 * `baz` → `bar` → `foo` → `app`. Filterable.
 */
export function LineageTable({ report, filter }: { report: BundleStateReport; filter: string }) {
  const rows = useMemo(() => buildLineageTable(report, filter), [report, filter]);

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
        <Network size={32} aria-hidden />
        <p className="text-sm">No matching packages.</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-well">
      <div className="p-1">
        {rows.map((row) => (
          <div key={row.fullName} className="border-b border-edge/50 last:border-0">
            <div className="flex items-center gap-2 px-2 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-ink">
                {row.fullName}
              </span>
              {row.version && <span className="shrink-0 text-xs text-faint">v{row.version}</span>}
              {row.usedByCount > 0 && (
                <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[11px] tabular-nums text-dim">
                  used by {row.usedByCount}
                </span>
              )}
            </div>
            <div className="pb-1">
              {row.children.length === 0 ? (
                <p className="px-6 pb-1 text-xs text-faint">shipped, no dependants mapped</p>
              ) : (
                row.children.map((child) => (
                  <DependantRow key={child.fullName} node={child} depth={0} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
