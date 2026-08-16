import { expose } from "comlink";
import { normalizeBundle, type NormalizeInput } from "@/lib/normalize";
import type { BundleStateReport } from "@/lib/types";
import type { NormalizerService } from "./workerTypes";

/**
 * Pollutes-free normalizer running inside its own worker. Receives the raw
 * parse output (zip entries, decoded maps) — nothing crosses back to the
 * main thread except the final plain `BundleStateReport`.
 */
export class Normalizer implements NormalizerService {
  constructor(private readonly input: NormalizeInput) {}

  async normalize(onProgress?: (fraction: number) => void): Promise<BundleStateReport> {
    onProgress?.(0.1);
    const report = await normalizeBundle(this.input);
    onProgress?.(1);
    return report;
  }
}

expose(Normalizer);
