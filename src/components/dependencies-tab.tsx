import { useMemo, useState } from "react";
import { ChevronRight, Workflow } from "lucide-react";
import { clsx } from "clsx";
import { buildDependencyTree, type DependencyNode } from "@/lib/dependencies";
import { FilterInput } from "./ui";
import type { BundleStateReport } from "@/lib/types";

function countNodes(nodes: DependencyNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

function Row({
  node,
  depth,
  onShowInGraph,
}: {
  node: DependencyNode;
  depth: number;
  onShowInGraph: (fullName: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-surface-2"
        style={{ paddingLeft: depth * 16 + 6 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setOpen((o) => !o)}
          disabled={!hasChildren}
          aria-label={open ? "Collapse" : "Expand"}
          className="shrink-0 rounded p-0.5 text-dim transition-colors hover:bg-surface disabled:invisible"
        >
          <ChevronRight
            size={14}
            className={clsx("transition-transform", open && "rotate-90")}
            aria-hidden
          />
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{node.fullName}</span>
        {node.version && <span className="shrink-0 text-xs text-faint">v{node.version}</span>}
        <button
          type="button"
          onClick={() => onShowInGraph(node.fullName)}
          aria-label={`View ${node.fullName} in graph`}
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
        >
          <Workflow size={12} aria-hidden /> in graph
        </button>
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <Row key={child.fullName} node={child} depth={depth + 1} onShowInGraph={onShowInGraph} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Dependencies tab: list every shipped dependency and its dependencies
 * (from the lockfile), each with a pointer to the lineage graph. Filterable.
 */
export function DependenciesTab({
  report,
  filter,
  onFilter,
  onShowInGraph,
}: {
  report: BundleStateReport;
  filter: string;
  onFilter: (value: string) => void;
  onShowInGraph: (fullName: string) => void;
}) {
  const tree = useMemo(() => buildDependencyTree(report, filter), [report, filter]);
  const count = useMemo(() => countNodes(tree), [tree]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <FilterInput value={filter} onChange={onFilter} placeholder="Filter dependencies…" />
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-edge bg-well">
        {tree.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
            <Workflow size={32} aria-hidden />
            <p className="text-sm">No matching dependencies.</p>
          </div>
        ) : (
          <div className="p-1">
            <p className="px-2 py-1 text-xs text-faint">
              {count} {count === 1 ? "dependency" : "dependencies"} (incl. transitive)
            </p>
            {tree.map((node) => (
              <Row key={node.fullName} node={node} depth={0} onShowInGraph={onShowInGraph} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
