import { useShallow } from "zustand/react/shallow";
import { Dropzone } from "./components/Dropzone";
import { JobsPanel } from "./components/JobsPanel";
import { ReportPanel } from "./components/ReportPanel";
import { Shell } from "./components/Shell";
import { useBundleStore } from "./state/store";
import { runParseJob } from "./state/runJob";

export default function App() {
  const jobs = useBundleStore(useShallow((state) => Object.values(state.jobs)));
  const reports = useBundleStore(useShallow((state) => Object.values(state.reports)));

  const handleFiles = (files: File[]) => {
    for (const file of files) {
      const id = useBundleStore.getState().addJob(file.name);
      void runParseJob(file, id);
    }
  };

  return (
    <Shell>
      <Dropzone onFiles={handleFiles} />
      <JobsPanel jobs={jobs} />
      {reports.map((report) => (
        <ReportPanel key={report.id} report={report} />
      ))}
    </Shell>
  );
}
