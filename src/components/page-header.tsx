import type { ReactNode } from "react";
import { clsx } from "clsx";

/**
 * Standard page header: a thin top band with a left slot (breadcrumb / title)
 * and a right slot for actions. Sticky beneath the viewport top so it stays
 * visible while the content below scrolls. Used by the report page; the tab
 * bar sits directly below it, between the header and the page content.
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
        "sticky top-0 z-20 flex items-center gap-3 border-b border-edge bg-canvas/95 px-3 py-2 backdrop-blur",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
