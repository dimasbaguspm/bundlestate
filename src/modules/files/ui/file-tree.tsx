import { useState } from "react";
import { ChevronDown, ChevronRight, File as FileIcon, Folder, FolderOpen } from "lucide-react";
import { clsx } from "clsx";
import { formatBytes } from "@/utils/format";
import type { FileTreeNode } from "@/modules/files/lib/file-tree";

/** Recursive directory browser for the Files tab. */
export function FileTree({
  node,
  selectedPath,
  onSelect,
  depth = 0,
}: {
  node: FileTreeNode;
  selectedPath: string | null;
  onSelect: (leaf: FileTreeNode) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (!node.isFile) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[13px] text-ink hover:bg-surface-2"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {open ? (
            <ChevronDown size={13} className="shrink-0 text-dim" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-dim" />
          )}
          {open ? (
            <FolderOpen size={13} className="shrink-0 text-accent" />
          ) : (
            <Folder size={13} className="shrink-0 text-accent" />
          )}
          <span className="truncate">{node.name || "root"}</span>
          <span className="ml-auto shrink-0 pl-2 font-mono text-[11px] tabular-nums text-faint">
            {formatBytes(node.bytes)}
          </span>
        </button>
        {open && (
          <div>
            {node.children.map((c) => (
              <FileTree
                key={c.path || "root"}
                node={c}
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;
  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={clsx(
        "flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[13px] hover:bg-surface-2",
        isSelected ? "bg-accent/15 text-accent" : "text-ink",
      )}
      style={{ paddingLeft: `${depth * 12 + 18}px` }}
      title={node.path}
    >
      <FileIcon size={13} className="shrink-0 text-dim" />
      <span className="truncate">{node.name}</span>
      <span className="ml-auto shrink-0 pl-2 font-mono text-[11px] tabular-nums text-faint">
        {formatBytes(node.bytes)}
      </span>
    </button>
  );
}
