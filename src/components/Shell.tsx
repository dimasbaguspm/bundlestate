import type { ReactNode } from "react";
import { BottomBar } from "@/components/BottomBar";

/**
 * Full-bleed app frame following the syntaxdiff layout: no top bar — a
 * flex column where the routed page owns all the space above a persistent
 * bottom bar. The main region is full width and fills the viewport.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-canvas text-ink supports-[height:100dvh]:h-dvh">
      <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">{children}</main>
      <BottomBar />
    </div>
  );
}
