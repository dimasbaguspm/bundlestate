import type { ReactNode } from "react";
import { clsx } from "clsx";

/**
 * Standard page header. On desktop it's a single row (left slot + right-aligned
 * actions). On mobile it stacks: the left slot (breadcrumb/title) on its own
 * row, then the actions wrap onto a second row so nothing is cramped or
 * clipped in a narrow viewport. Sticky beneath the viewport top so it stays
 * visible while the content below scrolls. The tab bar sits directly beneath
 * it (rendered by the page, not here).
 */
export function PageHeader({
  left,
  actions,
  className,
}: {
  /** Left slot — typically a Breadcrumb + title. */
  left: ReactNode;
  /** Right slot — report actions (copy, download, new, …). */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={clsx(
        "sticky top-0 z-20 flex flex-col gap-1 border-b border-edge bg-canvas/95 px-3 py-2 backdrop-blur sm:flex-row sm:items-center sm:gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
