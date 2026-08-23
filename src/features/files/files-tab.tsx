import { lazy, useMemo, useState, Suspense } from "react";
import { FileSearch, Binary } from "lucide-react";
import { buildFileTree, countFiles, type FileTreeNode } from "@/features/files/lib/fileTree";
import { FileTree } from "./FileTree";
import { FilterInput } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import type { BundleStateReport } from "@/lib/types";

const MonacoPreview = lazy(() => import("@/components/MonacoPreview").then((m) => ({ default: m.MonacoPreview })));

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

/** Best-effort decode of a base64 string to UTF-8 text. */
function decodeText(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // Replace non-printable control chars (except tab/newline) so binary
    // shows as readable-ish text rather than mojibake.
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      out += c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126) || c >= 160 ? String.fromCharCode(c) : "·";
    }
    return out;
  } catch {
    return "";
  }
}

/** Map a file extension to a Monaco language id. */
function langFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript",
    json: "json", css: "css", html: "html", htm: "html",
    md: "markdown", xml: "xml", svg: "xml", yml: "yaml", yaml: "yaml",
    txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

/** Files tab: directory browser (left) + Monaco raw/binary preview (right). */
export function FilesTab({
  report,
  filter,
  onFilter,
}: {
  report: BundleStateReport;
  filter: string;
  onFilter: (value: string) => void;
}) {
  const tree = useMemo(() => buildFileTree(report), [report]);
  const [selected, setSelected] = useState<FileTreeNode | null>(null);

  const fileCount = useMemo(() => countFiles(tree), [tree]);

  const preview = useMemo(() => {
    if (!selected || !selected.isFile) return null;
    const asset = selected.asset;
    const stat = selected.staticFile;
    if (asset) {
      const text = decodeText(asset.rawBytes);
      return { title: asset.name, lang: langFor(asset.name), value: text, bytes: asset.sizeBytes, note: null as string | null };
    }
    if (stat) {
      if (stat.rawBytes) {
        return { title: stat.path, lang: langFor(stat.path), value: decodeText(stat.rawBytes), bytes: stat.sizeBytes, note: null };
      }
      return { title: stat.path, lang: "plaintext", value: "", bytes: stat.sizeBytes, note: "Raw content was not extracted for this file (too large or skipped by the parser)." };
    }
    return null;
  }, [selected]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterInput value={filter} onChange={onFilter} placeholder="Filter files…" />
        <span className="text-[11px] uppercase tracking-wide text-faint">{fileCount} files</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[300px_1fr]">
        {/* Directory tree */}
        <div className="min-h-0 overflow-y-auto rounded-lg border border border-edge bg-well">
          {tree.children.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
              <FileSearch size={32} aria-hidden />
              <p className="text-sm">No files in this bundle.</p>
            </div>
          ) : (
            <div className="p-1">
              {tree.children.map((c) => (
                <FileTree key={c.path || "root"} node={c} selectedPath={selected?.path ?? null} onSelect={setSelected} />
              ))}
            </div>
          )}
        </div>

        {/* Monaco preview */}
        <div className="flex min-h-0 flex-col rounded-lg border border-edge bg-well">
          {!preview ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
              <Binary size={32} aria-hidden />
              <p className="text-sm">Select a file to preview its raw content.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-edge px-3 py-1.5">
                <span className="truncate font-mono text-[12px] text-ink" title={preview.title}>
                  {basename(preview.title)}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-faint">{formatBytes(preview.bytes)}</span>
              </div>
              {preview.note ? (
                <div className="p-4 text-sm text-dim">{preview.note}</div>
              ) : (
                <div className="min-h-0 flex-1">
                  <Suspense fallback={<div className="p-4 text-sm text-dim">Loading editor…</div>}>
                    <MonacoPreview language={preview.lang} value={preview.value} />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
