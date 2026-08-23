import type { BundleStateReport, StaticFile } from "@/lib/types";

/** A node in the Files-tab directory tree. */
export interface FileTreeNode {
  /** Full path (dir or file). */
  path: string;
  /** Basename for display. */
  name: string;
  /** True for leaves (files). */
  isFile: boolean;
  /** Child directories + files, sorted dirs-first then alphabetical. */
  children: FileTreeNode[];
  /** Present for file leaves: the originating static file (may lack content). */
  staticFile?: StaticFile;
  /** Present for asset leaves: the asset name + kind + base64 source. */
  asset?: { name: string; kind: string; rawBytes: string; sizeBytes: number };
}

/**
 * Build a nested directory tree from the report's static files and built
 * assets (js/css/html). Assets that carry raw source are surfaced as
 * previewable leaves; static files are leaves too (preview shows their
 * captured content when present, otherwise metadata only).
 */
export function buildFileTree(report: BundleStateReport): FileTreeNode {
  const root: FileTreeNode = { path: "", name: "", isFile: false, children: [] };

  const ensureDir = (parts: string[]): FileTreeNode => {
    let node = root;
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      let next = node.children.find((c) => !c.isFile && c.name === part);
      if (!next) {
        next = { path: acc, name: part, isFile: false, children: [] };
        node.children.push(next);
      }
      node = next;
    }
    return node;
  };

  const addFile = (fullPath: string, leaf: FileTreeNode) => {
    const sep = fullPath.lastIndexOf("/");
    const dirParts = sep === -1 ? [] : fullPath.slice(0, sep).split("/").filter(Boolean);
    const dir = ensureDir(dirParts);
    dir.children.push(leaf);
  };

  for (const f of report.files ?? []) {
    addFile(f.path, {
      path: f.path,
      name: f.path.split("/").pop() ?? f.path,
      isFile: true,
      children: [],
      staticFile: f,
    });
  }

  for (const a of report.assets) {
    if (a.kind === "other" || !a.rawBytes) continue;
    addFile(a.name, {
      path: a.name,
      name: a.name.split("/").pop() ?? a.name,
      isFile: true,
      children: [],
      asset: { name: a.name, kind: a.kind, rawBytes: a.rawBytes, sizeBytes: a.sizeBytes },
    });
  }

  sortTree(root);
  return root;
}

function sortTree(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1; // dirs first
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}

/** Count file leaves under a node. */
export function countFiles(node: FileTreeNode): number {
  if (node.isFile) return 1;
  return node.children.reduce((s, c) => s + countFiles(c), 0);
}
