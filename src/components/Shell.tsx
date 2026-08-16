import type { ReactNode } from "react";
import { BottomBar } from "@/components/BottomBar";

/**
 * Full-bleed app frame following the syntaxdiff layout: no top bar — a
 * flex column where the routed page owns all the space above a persistent
 * bottom bar. The main region is full width, fills the viewport, and scrolls
 * independently so the bottom bar always stays in place.
 */
export function Shell({
  children,
  onOpenHistory,
  onOpenHelp,
}: {
  children: ReactNode;
  onOpenHistory: () => void;
  onOpenHelp: () => void;
}) {
  return (
    <div className="flex h-screen flex-col bg-canvas text-ink supports-[height:100dvh]:h-dvh">
      <main className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">{children}</main>
      <BottomBar onOpenHistory={onOpenHistory} onOpenHelp={onOpenHelp} />
    </div>
  );
}
