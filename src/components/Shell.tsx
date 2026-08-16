import { PackageSearch } from "lucide-react";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/40 bg-surface-2 text-ink">
            <PackageSearch size={20} aria-hidden />
          </span>
          <div className="leading-tight">
            <h1 className="font-mono text-lg font-semibold tracking-tight text-ink">BundleState</h1>
            <p className="text-xs text-muted">
              100% client-side bundle diagnostics — nothing leaves the browser
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">{children}</main>
      <footer className="border-t border-line py-4 text-center text-xs text-muted">
        Built with React · Vite · Tailwind v4 · ECharts — all analysis runs in Web Workers
      </footer>
    </div>
  );
}
