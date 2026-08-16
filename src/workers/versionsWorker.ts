import { expose } from "comlink";
import { fetchLatestVersions } from "@/lib/npmVersions";
import type { VersionsWorkerService } from "./workerTypes";

/**
 * Versions sub-worker: resolves the latest published npm version for each
 * shipped package. Kept off the main thread so slow registry responses can
 * never jank the UI. Only package names are sent — the bundle stays local.
 */
const service: VersionsWorkerService = {
  checkVersions(packages) {
    return fetchLatestVersions(packages.map((p) => p.fullName));
  },
};

expose(service);