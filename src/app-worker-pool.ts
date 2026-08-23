import { wrap, type Remote } from "comlink";
import type { ParseWorkerService } from "@/core/worker/worker-types";

const MAX_WORKERS = 2;

/**
 * Orchestrates one ParseWorker per dropped zip, reusing idle workers and
 * bounding concurrency. Each parse worker owns one NormalizeSubWorker.
 */
export class AppWorkerPool {
  private readonly workers: Remote<ParseWorkerService>[] = [];
  private readonly idle: Remote<ParseWorkerService>[] = [];
  private readonly waiters: Array<() => void> = [];

  acquire(): Promise<Remote<ParseWorkerService>> {
    const idle = this.idle.pop();
    if (idle) return Promise.resolve(idle);

    if (this.workers.length < MAX_WORKERS) {
      const worker = wrap<ParseWorkerService>(
        new Worker(new URL("./core/worker/parse-worker.ts", import.meta.url), {
          type: "module",
        }),
      );
      this.workers.push(worker);
      return Promise.resolve(worker);
    }

    return new Promise((resolve) => {
      this.waiters.push(() => resolve(this.idle.pop()!));
    });
  }

  release(worker: Remote<ParseWorkerService>): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter();
    else this.idle.push(worker);
  }
}
