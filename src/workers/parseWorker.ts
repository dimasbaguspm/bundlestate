import { expose, wrap, type Remote } from "comlink";
import { collectAssets } from "../lib/parseAssets";
import { extractZip } from "../lib/zip";
import type { NormalizeInput } from "../lib/normalize";
import { Normalizer } from "./normalizeSubWorker";
import type { AbortHandle, NormalizerService, ParseWorkerService } from "./workerTypes";

/**
 * One parse worker per dropped zip. Extracts the archive from a
 * `ReadableStream` (progress + abort), auto-detects the bundler, inspects
 * every asset for inline/sidecar source maps, then hands the raw input to
 * the NormalizeSubWorker via a comlink proxy. Zip contents never leave
 * worker memory.
 */
class ParseWorker implements ParseWorkerService {
  private readonly normalizerCtor: Remote<typeof Normalizer>;

  constructor() {
    const subWorker = new Worker(new URL("./normalizeSubWorker.ts", import.meta.url), {
      type: "module",
    });
    this.normalizerCtor = wrap<typeof Normalizer>(subWorker);
  }

  async parseZip(
    file: File,
    onProgress: ((fraction: number) => void) | undefined,
    abortHandle: Remote<AbortHandle>,
  ): Promise<Remote<NormalizerService>> {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      throw new Error(`Not a zip file: ${file.name}`);
    }

    const entries = await extractZip(file.stream(), {
      expectedBytes: file.size,
      onProgress,
      shouldAbort: async () => (await abortHandle.isAborted()) ?? false,
    });

    const assets = collectAssets(entries);
    if (assets.length > 0 && assets.every((a) => !a.mapSources)) {
      throw new Error("No source maps found — add .map files (inline or sidecar) and retry.");
    }

    const input: NormalizeInput = { sourceName: file.name, assets, entries };
    return new this.normalizerCtor(input);
  }
}

expose(new ParseWorker());
