import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { clsx } from "clsx";

export interface Crumb {
  label: string;
  /** Optional link target. Omit for the current (last) crumb. */
  to?: string;
}

/**
 * Breadcrumb trail. The last crumb is rendered as the current page (muted,
 * non-interactive); earlier crumbs are links. Used in the report PageHeader
 * to show `Home / <report name>`.
 */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={clsx("flex min-w-0 items-center gap-1 text-sm", className)}
    >
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="shrink-0 text-faint" aria-hidden />}
            {c.to && !last ? (
              <Link to={c.to} className="truncate text-dim hover:text-ink hover:underline">
                {c.label}
              </Link>
            ) : (
              <span
                className={clsx("truncate", last ? "font-medium text-ink" : "text-dim")}
                aria-current={last ? "page" : undefined}
              >
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
