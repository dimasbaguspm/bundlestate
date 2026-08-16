import { useEffect, useState } from "react";
import { Bookmark, MessageSquareText, Moon, Sun, Tag } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { APP_VERSION } from "@/constants/version";
import { SITE_HOST, SITE_NAME, SITE_URL } from "@/constants/site";
import { listReports } from "@/db";

const FEEDBACK_URL = "https://github.com/dimasbaguspm/bundlestate/issues";

/** Persistent bottom bar following the syntaxdiff pattern exactly: history
 * entrypoint on the left, site URL in the center, version + theme + feedback
 * on the right. */
export function BottomBar({ onOpenHistory }: { onOpenHistory: () => void }) {
  const { theme, toggle } = useTheme();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    void listReports().then((r) => {
      if (active) setCount(r.length);
    });
    return () => {
      active = false;
    };
  }, []);

  const openHistory = () => {
    onOpenHistory();
    void listReports().then((r) => setCount(r.length));
  };

  return (
    <footer className="relative z-30 shrink-0 border-t border-edge">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-1">
        <div className="flex items-center justify-start gap-0.5">
          <button
            type="button"
            onClick={openHistory}
            aria-label="History"
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Bookmark className="size-4" aria-hidden />
            <span className="text-xs font-medium tabular-nums sm:hidden">{count}</span>
            <span className="hidden text-xs font-medium tabular-nums sm:inline">
              {count} Reports
            </span>
          </button>
        </div>

        <a
          href={SITE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-dim transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span className="hidden sm:inline">{SITE_HOST}</span>
          <span className="sm:hidden">{SITE_NAME}</span>
        </a>

        <div className="flex items-center justify-end gap-1 sm:gap-3">
          <span className="hidden items-center gap-1 rounded-full border border-edge px-2 py-0.5 font-mono text-[11px] font-medium text-accent sm:flex">
            <Tag className="size-3" aria-hidden />v{APP_VERSION}
          </span>

          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded p-1.5 text-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {theme === "dark" ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Moon className="size-4" aria-hidden />
            )}
          </button>

          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-strong sm:flex"
          >
            <MessageSquareText className="size-4" aria-hidden />
            Feedback
          </a>
        </div>
      </div>
    </footer>
  );
}
