import { create } from "zustand";
import type { BundleStateReport } from "@/lib/types";

export type JobStatus = "pending" | "extracting" | "normalizing" | "done" | "error" | "aborted";

export interface Job {
  id: string;
  sourceName: string;
  status: JobStatus;
  /** 0..1 overall pipeline progress (extract → normalize). */
  progress: number;
  error?: string;
  reportId?: string;
  /** Set while the job runs; lets the Dropzone UI abort. */
  abort?: AbortController;
}

interface BundleStateStore {
  jobs: Record<string, Job>;
  reports: Record<string, BundleStateReport>;
  /** Report id of the currently open detail page, or null on the landing page. */
  activeReportId: string | null;
  addJob: (sourceName: string) => string;
  updateJob: (id: string, patch: Partial<Job>) => void;
  setJobAbort: (id: string, abort: AbortController) => void;
  addReport: (report: BundleStateReport) => void;
  removeReport: (id: string) => void;
  clearAll: () => void;
  setActiveReport: (id: string | null) => void;
}

export const useBundleStore = create<BundleStateStore>()((set) => ({
  jobs: {},
  reports: {},
  activeReportId: null,

  addJob: (sourceName) => {
    const id = crypto.randomUUID();
    set((state) => ({
      jobs: { ...state.jobs, [id]: { id, sourceName, status: "pending", progress: 0 } },
    }));
    return id;
  },

  updateJob: (id, patch) =>
    set((state) => {
      const job = state.jobs[id];
      if (!job) return state;
      return { jobs: { ...state.jobs, [id]: { ...job, ...patch } } };
    }),

  setJobAbort: (id, abort) =>
    set((state) => {
      const job = state.jobs[id];
      if (!job) return state;
      return { jobs: { ...state.jobs, [id]: { ...job, abort } } };
    }),

  addReport: (report) => set((state) => ({ reports: { ...state.reports, [report.id]: report } })),

  removeReport: (id) =>
    set((state) => {
      const reports = { ...state.reports };
      delete reports[id];
      return { reports };
    }),

  clearAll: () => set({ jobs: {}, reports: {}, activeReportId: null }),

  setActiveReport: (id) => set({ activeReportId: id }),
}));

export function selectJobsList(jobs: Record<string, Job>): Job[] {
  return Object.values(jobs).sort((a, b) => a.id.localeCompare(b.id));
}

export function selectReportsList(reports: Record<string, BundleStateReport>): BundleStateReport[] {
  return Object.values(reports).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}
