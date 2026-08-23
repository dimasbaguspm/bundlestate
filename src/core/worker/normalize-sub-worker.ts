import { expose } from "comlink";
import { normalizeBundle, type NormalizeInput } from "@/utils/normalize";
import type { BundleStateReport } from "@/utils/types";
import type { NormalizerService } from "./worker-types";
import { trace } from "./trace";

/**
 * Pollutes-free normalizer running inside its own worker. Receives the raw
 * parse output (zip entries, decoded maps) — nothing crosses back to the
 * main thread except the final plain `BundleStateReport`.
 */
export class Normalizer implements NormalizerService {
  constructor(private readonly input: NormalizeInput) {}

  async normalize(onProgress?: (fraction: number) => void): Promise<BundleStateReport> {
    onProgress?.(0.1);
    trace("normalize-start", {});
    const report = await normalizeBundle(this.input);
    trace("normalize-done", {
      id: report.id,
      packages: report.packages.length,
      assets: report.assets.length,
    });
    onProgress?.(1);
    return report;
  }
}

expose(Normalizer);
