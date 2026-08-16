import { FileArchive, UploadCloud } from "lucide-react";
import { clsx } from "clsx";
import { useRef, useState, type DragEvent } from "react";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
}

/**
 * HTML5 drag-and-drop entry point. Accepts one or more `.zip` files. No
 * folder picker, no metafile mode — exactly one way in, per the MVP.
 */
export function Dropzone({ onFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (files: FileList | File[]) => {
    const zips = [...files].filter(
      (f) => f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip"),
    );
    const skipped = [...files].length - zips.length;
    setError(
      skipped > 0
        ? `Ignored ${skipped} non-zip ${skipped === 1 ? "file" : "files"} — only .zip uploads are supported.`
        : null,
    );
    if (zips.length > 0) onFiles(zips);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a bundle zip here"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          dragging ? "border-ink bg-surface-2" : "border-edge bg-surface hover:border-ink/40",
        )}
      >
        {dragging ? (
          <UploadCloud size={40} className="text-ink" aria-hidden />
        ) : (
          <FileArchive size={40} className="text-dim" aria-hidden />
        )}
        <div className="space-y-1">
          <p className="text-base font-medium">
            Drag &amp; drop your bundle <span className="font-mono text-ink">.zip</span>
          </p>
          <p className="text-sm text-dim">
            or click to browse — must contain built JS with source maps
          </p>
        </div>
        <p className="font-mono text-xs text-dim">
          requires inline <span className="text-ink-dim">//# sourceMappingURL=data:…</span> or
          sidecar <span className="text-ink-dim">.map</span> files
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        multiple
        className="hidden"
        data-testid="zip-input"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
