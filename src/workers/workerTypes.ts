import type { Remote } from "comlink";
import type { BundleStateReport } from "@/lib/types";

/**
 * Progress snapshot returned by `getProgress`. Workers report progress via
 * polling (like `AbortHandle`) instead of callbacks: comlink proxies cannot
 * forward function arguments through a nested worker tunnel (functions are
 * not structured-cloneable), so NOTHING crossing a worker boundary is a
 * function.
 */
export interface ParseProgress {
  phase: "extracting" | "normalizing" | "done";
  fraction: number;
  error?: string;
}

/** Interface exposed by each ParseWorker (proxied from the main thread). */
export interface ParseWorkerService {
  /**
   * Kick off extraction + normalization prep for a dropped zip. Returns a
   * report id IMMEDIATELY; work continues in the background. Nothing from
   * the zip ever crosses back to the main thread.
   */
  parseZip(file: File, abortHandle: Remote<AbortHandle>): Promise<string>;
  /** Poll progress for a report id. */
  getProgress(reportId: string): Promise<ParseProgress>;
  /** Run normalization for a prepared report and return the plain report. */
  normalize(reportId: string): Promise<BundleStateReport>;
}

/**
 * Abort coordination: the main thread passes a comlink proxy of this shape
 * into the worker; the worker polls `isAborted()` between reads.
 */
export interface AbortHandle {
  isAborted(): boolean;
}

/** Interface exposed by the NormalizeSubWorker. */
export interface NormalizerService {
  normalize(onProgress?: (fraction: number) => void): Promise<BundleStateReport>;
}
