import { X } from "lucide-react";

const STEPS = [
  "Build your app with source maps enabled — e.g. a standard `vite build` produces `dist/` with sidecar `.map` files.",
  "Zip that build output (`.zip`, `.tar.gz`, or `.tgz`).",
  "Drop the zip on the landing page — or click to browse. Analysis runs entirely in your browser.",
  "Open the report. The Treemap shows package sizes (scroll to zoom; bigger tile = bigger space).",
  "Switch to Lineage to see how packages depend on each other — connected, drillable by package.",
  "Use Dependencies to list every package and its dependencies-of-dependencies.",
  "Each tab has a live filter — type a package name to isolate it for debugging.",
  "Nothing leaves your machine. All parsing happens in Web Workers.",
];

/**
 * Ordered "how to use" guide, opened from the bottom-bar entrypoint.
 */
export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to use BundleState"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-edge bg-surface shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-edge px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">How to use BundleState</h2>
          <button
            type="button"
            aria-label="Close help"
            onClick={onClose}
            className="ml-auto rounded p-1 text-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </header>
        <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-xs font-semibold text-accent">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
