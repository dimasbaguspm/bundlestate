import { expose, wrap, type Remote } from "comlink";
import { collectAssets } from "@/lib/parseAssets";
import { extractZip } from "@/lib/zip";
import type { NormalizeInput } from "@/lib/normalize";
import type { BundleStateReport } from "@/lib/types";
import { Normalizer } from "./normalizeSubWorker";
import type {
  AbortHandle,
  NormalizerService,
  ParseProgress,
  ParseWorkerService,
} from "./workerTypes";

interface Job {
  instance: Remote<NormalizerService> | null;
  progress: ParseProgress;
  error?: string;
}

/**
 * One parse worker per dropped zip. Extracts the archive from a
 * `ReadableStream` (progress + abort), auto-detects the bundler, inspects
 * every asset for inline/sidecar source maps, then hands the raw input to
 * the NormalizeSubWorker via a comlink proxy. Zip contents never leave
 * worker memory.
 *
 * Progress is polled via `getProgress`, never pushed via callbacks — a
 * callback can cross ONE comlink boundary, but returning the normalizer
 * proxy from `parseZip` creates a nested tunnel, and forwarding a function
 * argument through that tunnel would try to structured-clone it. So the
 * main thread polls; workers keep their callbacks local.
 */
class ParseWorker implements ParseWorkerService {
  private readonly normalizerCtor: Remote<typeof Normalizer>;
  private readonly jobs = new Map<string, Job>();

  constructor() {
    const subWorker = new Worker(new URL("./normalizeSubWorker.ts", import.meta.url), {
      type: "module",
    });
    this.normalizerCtor = wrap<typeof Normalizer>(subWorker);
  }

  parseZip(file: File, abortHandle: Remote<AbortHandle>): Promise<string> {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return Promise.reject(new Error(`Not a zip file: ${file.name}`));
    }

    const reportId = crypto.randomUUID();
    const job: Job = { instance: null, progress: { phase: "extracting", fraction: 0 } };
    this.jobs.set(reportId, job);

    // Background pipeline: extraction → asset collection → normalizer prep.
    void (async () => {
      try {
        const entries = await extractZip(file.stream(), {
          expectedBytes: file.size,
          onProgress: (fraction) => {
            job.progress = { phase: "extracting", fraction };
          },
          shouldAbort: async () => (await abortHandle.isAborted()) ?? false,
        });

        const assets = collectAssets(entries);
        if (assets.length === 0) {
          throw new Error("No JS assets found in the zip — expected built .js/.mjs/.cjs files.");
        }
        if (assets.every((a) => !a.mapSources)) {
          throw new Error("No source maps found — add .map files (inline or sidecar) and retry.");
        }

        job.progress = { phase: "normalizing", fraction: 0 };
        const input: NormalizeInput = { sourceName: file.name, assets, entries };
        job.instance = await new this.normalizerCtor(input);
        job.progress = { phase: "done", fraction: 1 };
      } catch (error) {
        job.error = error instanceof Error ? error.message : String(error);
      }
    })();

    return Promise.resolve(reportId);
  }

  async getProgress(reportId: string): Promise<ParseProgress> {
    const job = this.jobs.get(reportId);
    if (!job) return { phase: "done", fraction: 1 };
    return job.error ? { ...job.progress, error: job.error } : job.progress;
  }

  async normalize(reportId: string): Promise<BundleStateReport> {
    const job = this.jobs.get(reportId);
    if (job?.error) throw new Error(job.error);
    if (!job?.instance)
      throw new Error("Report is not ready — call getProgress until phase 'done'.");
    job.progress = { phase: "normalizing", fraction: 0.5 };
    try {
      return await job.instance.normalize();
    } finally {
      job.progress = { phase: "done", fraction: 1 };
    }
  }
}

expose(new ParseWorker());
