import { Moon, PackageSearch, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import { useLocation } from "react-router-dom";
import { APP_VERSION } from "@/constants/version";
import { SITE_HOST } from "@/constants/site";
import { useTheme } from "@/hooks/use-theme";

/**
 * Full-bleed app frame: slim sticky header, routed page in a flex column
 * that fills the viewport, and a footer shown only on the landing page.
 * Report pages drop the footer and tighten the header so the canvas owns
 * the whole remaining viewport.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const onReportPage = pathname.startsWith("/r/");

  return (
    <div className="flex h-screen flex-col bg-canvas text-ink supports-[height:100dvh]:h-dvh">
      <header
        className={clsx(
          "shrink-0 border-b border-edge bg-canvas/90 backdrop-blur",
          onReportPage ? "py-1.5" : "py-3",
        )}
      >
        <div
          className={clsx(
            "mx-auto flex w-full items-center gap-3 px-4",
            onReportPage ? "max-w-none" : "max-w-6xl",
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink/40 bg-surface-2 text-accent">
            <PackageSearch size={18} aria-hidden />
          </span>
          <div className="leading-tight">
            <h1 className="font-mono text-base font-semibold tracking-tight text-ink">
              BundleState
            </h1>
            {!onReportPage && <p className="text-xs text-dim">100% client-side bundle diagnostics</p>}
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="ml-auto rounded p-1.5 text-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      {!onReportPage && (
        <footer className="shrink-0 border-t border-edge py-4 text-center text-xs text-faint">
          <span className="font-mono">BundleState v{APP_VERSION}</span> · {SITE_HOST} · all
          analysis runs in Web Workers
        </footer>
      )}
    </div>
  );
}