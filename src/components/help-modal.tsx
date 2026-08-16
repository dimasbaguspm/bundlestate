import { X } from "lucide-react";

const STEPS = [
  "Build your app with source maps on. A standard `vite build` outputs `dist/` with sidecar `.map` files.",
  "Zip that build output as `.zip`, `.tar.gz`, or `.tgz`.",
  "Drop the zip on the landing page, or click to browse. Analysis runs in your browser.",
  "In the Treemap, each package fills an area proportional to its size, grouped by the file it ships in. It stays responsive on mobile.",
  "In List, expand a package to see who depends on it, transitively up to the app. Packages with multiple versions are listed per version, like `foo@1.0.0` and `foo@2.0.0`.",
  "Files lists static assets such as images, fonts, and css, grouped by type.",
  "Type in a filter to isolate a package. Copy report pastes a Markdown summary into your pull request.",
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
          <h2 className="text-sm font-semibold text-ink">How to use</h2>
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
