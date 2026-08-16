import type { Remote } from "comlink";
import type { NormalizeInput } from "../lib/normalize";
import type { BundleStateReport } from "../lib/types";

/** Interface exposed by each ParseWorker (proxied from the main thread). */
export interface ParseWorkerService {
  /**
   * Extract + parse a dropped zip inside the worker and return a comlink
   * proxy to the NormalizeSubWorker that owns the resulting report.
   */
  parseZip(
    file: File,
    onProgress: ((fraction: number) => void) | undefined,
    abortHandle: Remote<AbortHandle>,
  ): Promise<Remote<NormalizerService>>;
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

/** Constructor shape of the class exposed by the sub-worker. */
export interface NormalizerCtor {
  new (input: NormalizeInput): NormalizerService;
}
