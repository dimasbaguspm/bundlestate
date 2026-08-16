import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Dropzone } from "@/components/Dropzone";
import { JobsPanel } from "@/components/JobsPanel";
import { ErrorBanner } from "@/components/ui";
import { listReports } from "@/db";
import { runParseJob } from "@/state/runJob";
import { useBundleStore } from "@/state/store";

interface RecentReport {
  id: string;
  sourceName: string;
  generatedAt: string;
}

/**
 * Landing page: full-height upload dropzone, live job progress and a short
 * "recent reports" list from IndexedDB. A finished analysis navigates to
 * its `/r/:id` detail page.
 */
export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const jobs = useBundleStore(useShallow((state) => Object.values(state.jobs)));
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const missingReport = (location.state as { missingReport?: string } | null)?.missingReport;

  useEffect(() => {
    void listReports().then(setRecent);
  }, []);

  const handleFiles = (files: File[]) => {
    for (const file of files) {
      const id = useBundleStore.getState().addJob(file.name);
      void runParseJob(file, id, { onDone: (reportId) => navigate(`/r/${reportId}`) });
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col justify-center gap-6 px-4 py-8">
      {missingReport && (
        <ErrorBanner message={`Report “${missingReport}” was not found — it may have been removed.`} />
      )}
      <Dropzone onFiles={handleFiles} />
      <JobsPanel jobs={jobs} />

      {recent.length > 0 && (
        <section aria-label="Recent reports" className="rounded-lg border border-edge bg-surface p-4">
          <h2 className="text-sm font-medium text-ink">Recent reports</h2>
          <ul className="mt-2 space-y-1">
            {recent.map((report) => (
              <li key={report.id}>
                <Link
                  to={`/r/${report.id}`}
                  className="flex items-baseline justify-between gap-3 rounded px-1 py-1 font-mono text-sm text-ink hover:text-accent"
                >
                  <span className="truncate">{report.sourceName}</span>
                  <span className="shrink-0 text-xs text-faint">
                    {new Date(report.generatedAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}