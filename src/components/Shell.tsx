import { Moon, PackageSearch, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { APP_VERSION } from "@/constants/version";
import { SITE_HOST } from "@/constants/site";
import { useTheme } from "@/hooks/use-theme";

export function Shell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="shrink-0 border-b border-edge bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/40 bg-surface-2 text-accent">
            <PackageSearch size={20} aria-hidden />
          </span>
          <div className="leading-tight">
            <h1 className="font-mono text-lg font-semibold tracking-tight text-ink">
              BundleState
            </h1>
            <p className="text-xs text-dim">
              100% client-side bundle diagnostics — nothing leaves the browser
            </p>
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
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">{children}</main>
      <footer className="shrink-0 border-t border-edge py-4 text-center text-xs text-faint">
        <span className="font-mono">BundleState v{APP_VERSION}</span> · {SITE_HOST} · all
        analysis runs in Web Workers
      </footer>
    </div>
  );
}