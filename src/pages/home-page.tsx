import { useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Dropzone } from "@/components/dropzone";
import { JobsPanel } from "@/components/jobs-panel";
import { ErrorBanner } from "@/components/ui";
import { runParseJob } from "@/core/stores/run-job";
import { useBundleStore } from "@/core/stores/store";

/**
 * Landing page: a full-height, full-width dropzone that owns the whole
 * viewport above the bottom bar. Live job progress renders beneath it while
 * an analysis runs; a finished analysis navigates to its `/r/:id` page.
 */
export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const jobs = useBundleStore(useShallow((state) => Object.values(state.jobs)));
  const missingReport = (location.state as { missingReport?: string } | null)?.missingReport;

  const handleFiles = (files: File[]) => {
    for (const file of files) {
      const id = useBundleStore.getState().addJob(file.name);
      void runParseJob(file, id, { onDone: (reportId) => navigate(`/r/${reportId}`) });
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-4">
      {missingReport && (
        <ErrorBanner
          message={`Report “${missingReport}” was not found — it may have been removed.`}
        />
      )}
      <Dropzone onFiles={handleFiles} />
      {jobs.length > 0 && <JobsPanel jobs={jobs} />}
    </div>
  );
}
