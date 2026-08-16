import { wrap, type Remote } from "comlink";
import type { VersionResult, VersionsWorkerService } from "./workerTypes";

export interface VersionsClient {
  checkVersions(packages: { fullName: string }[]): Promise<VersionResult[]>;
  dispose(): Promise<void>;
}

let pending: Promise<{ worker: Worker; remote: Remote<VersionsWorkerService> }> | null = null;

/**
 * Lazy comlink client for the single versions worker. One worker serves one
 * check per report page; `dispose()` terminates it so the next page spins up
 * a fresh one.
 */
export function createVersionsClient(): VersionsClient {
  const getWorker = () =>
    (pending ??= Promise.resolve(
      (async () => {
        const worker = new Worker(new URL("./versionsWorker.ts", import.meta.url), {
          type: "module",
        });
        return { worker, remote: wrap<VersionsWorkerService>(worker) };
      })(),
    ));

  return {
    async checkVersions(packages) {
      return (await getWorker()).remote.checkVersions(packages);
    },
    async dispose() {
      const client = await pending;
      client?.worker.terminate();
      pending = null;
    },
  };
}