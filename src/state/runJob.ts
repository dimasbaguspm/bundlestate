import { proxy, type Remote } from "comlink";
import { AppWorkerPool } from "../AppWorkerPool";
import type { AbortHandle } from "../workers/workerTypes";
import { useBundleStore } from "./store";

let pool: AppWorkerPool | null = null;

function getPool(): AppWorkerPool {
  pool ??= new AppWorkerPool();
  return pool;
}

/**
 * Run the full parse → normalize pipeline for one dropped zip, streaming
 * progress into the zustand store and honouring the job's abort controller.
 */
export async function runParseJob(file: File, jobId: string): Promise<void> {
  const { updateJob, setJobAbort, addReport } = useBundleStore.getState();
  const abort = new AbortController();
  setJobAbort(jobId, abort);

  const worker = await getPool().acquire();
  try {
    updateJob(jobId, { status: "extracting", progress: 0 });

    const onExtract = (fraction: number) => {
      updateJob(jobId, { status: "extracting", progress: fraction });
    };
    const abortHandle: AbortHandle = { isAborted: () => abort.signal.aborted };
    const normalizer = await worker.parseZip(
      file,
      proxy(onExtract),
      // Comlink proxies are structurally different from their Remote type.
      proxy(abortHandle) as unknown as Remote<AbortHandle>,
    );

    updateJob(jobId, { status: "normalizing", progress: 0.5 });
    const onNormalize = (fraction: number) => {
      updateJob(jobId, { status: "normalizing", progress: 0.5 + fraction * 0.5 });
    };
    const report = await normalizer.normalize(proxy(onNormalize));

    addReport(report);
    updateJob(jobId, { status: "done", progress: 1, reportId: report.id });
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
