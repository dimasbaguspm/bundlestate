import { Moon, PackageSearch, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { APP_VERSION } from "@/constants/version";
import { SITE_HOST } from "@/constants/site";

/**
 * Persistent bottom bar, following the syntaxdiff pattern (grid with
 * left / center / right columns). Slim enough to never crowd the canvas.
 */
export function BottomBar() {
  const { theme, toggle } = useTheme();

  return (
    <footer className="relative z-30 shrink-0 border-t border-edge">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-1">
        <div className="flex items-center justify-start gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-ink/40 bg-surface-2 text-accent">
            <PackageSearch size={13} aria-hidden />
          </span>
          <span className="font-mono text-xs font-semibold text-ink">BundleState</span>
          <span className="hidden text-xs text-faint sm:inline">100% client-side diagnostics</span>
        </div>

        <a
          href={`https://${SITE_HOST}`}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded px-2 py-1 font-mono text-xs font-medium text-dim transition-colors hover:bg-surface-2 hover:text-ink sm:flex"
        >
          {SITE_HOST}
        </a>

        <div className="flex items-center justify-end gap-2">
          <span className="hidden items-center gap-1 rounded-full border border-edge px-2 py-0.5 font-mono text-[11px] font-medium text-accent sm:flex">
            v{APP_VERSION}
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded p-1.5 text-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          </button>
        </div>
      </div>
    </footer>
  );
}
