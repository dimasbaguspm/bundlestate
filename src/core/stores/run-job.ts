import { proxy, type Remote } from "comlink";
import { AppWorkerPool } from "@/app-worker-pool";
import { saveReport } from "@/db";
import type { AbortHandle } from "@/core/worker/worker-types";
import { useBundleStore } from "./store";

let pool: AppWorkerPool | null = null;

function getPool(): AppWorkerPool {
  pool ??= new AppWorkerPool();
  return pool;
}

const POLL_INTERVAL_MS = 120;

/**
 * Run the full parse → normalize pipeline for one dropped archive, streaming
 * progress into the zustand store and honouring the job's abort controller.
 *
 * Progress is POLLED, never pushed: comlink proxies cannot forward function
 * arguments through the nested parse→normalize worker tunnel, so no
 * callback ever crosses a worker boundary (see workers/workerTypes.ts).
 */
export async function runParseJob(
  file: File,
  jobId: string,
  options: { onDone?: (reportId: string) => void } = {},
): Promise<void> {
  const { updateJob, setJobAbort, addReport } = useBundleStore.getState();
  const abort = new AbortController();
  setJobAbort(jobId, abort);

  const worker = await getPool().acquire();
  try {
    updateJob(jobId, { status: "extracting", progress: 0 });

    const abortHandle: AbortHandle = { isAborted: () => abort.signal.aborted };
    const reportId = await worker.parseZip(
      file,
      // Comlink proxies are structurally different from their Remote type.
      proxy(abortHandle) as unknown as Remote<AbortHandle>,
    );

    // Poll until the normalizer is prepared (extraction + prep in worker).
    for (;;) {
      const progress = await worker.getProgress(reportId);
      if (progress.error) throw new Error(progress.error);
      if (progress.phase === "done") break;
      updateJob(jobId, { status: "extracting", progress: progress.fraction });
      if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
      await sleep(POLL_INTERVAL_MS);
    }

    updateJob(jobId, { status: "normalizing", progress: 0.5 });
    const report = await worker.normalize(reportId);

    addReport(report);
    await saveReport(report);
    updateJob(jobId, { status: "done", progress: 1, reportId: report.id });
    options.onDone?.(report.id);
  } catch (error) {
    if (abort.signal.aborted) {
      updateJob(jobId, { status: "aborted" });
    } else {
      updateJob(jobId, { status: "error", error: errorMessage(error) });
    }
  } finally {
    getPool().release(worker);
  }
}

export function abortJob(jobId: string): void {
  useBundleStore.getState().jobs[jobId]?.abort?.abort();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
