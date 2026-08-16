import { describe, expect, it, vi } from "vitest";
import {
  encodeScopedName,
  fetchLatestVersions,
  registryUrl,
  type VersionFetcher,
} from "./npmVersions";

const okFetcher =
  (version?: string): VersionFetcher =>
  async () => ({ version });

describe("registryUrl", () => {
  it("encodes scoped package names for the registry", () => {
    expect(encodeScopedName("@scope/name")).toBe("@scope%2fname");
    expect(encodeScopedName("lodash")).toBe("lodash");
  });

  it("builds the latest endpoint", () => {
    expect(registryUrl("@scope/name")).toBe("https://registry.npmjs.org/@scope%2fname/latest");
  });
});

describe("fetchLatestVersions", () => {
  it("returns the parsed version per package", async () => {
    const results = await fetchLatestVersions(["react", "lodash"], okFetcher("1.0.0"));
    expect(results).toEqual([
      { fullName: "react", latest: "1.0.0" },
      { fullName: "lodash", latest: "1.0.0" },
    ]);
  });

  it("reports null when a fetch fails or returns no version", async () => {
    const flaky: VersionFetcher = async (fullName) =>
      fullName === "broken" ? null : { version: "2.0.0" };
    const results = await fetchLatestVersions(["broken", "fine"], flaky);
    expect(results).toEqual([
      { fullName: "broken", latest: null },
      { fullName: "fine", latest: "2.0.0" },
    ]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const fetcher: VersionFetcher = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return { version: "1.0.0" };
    };

    await fetchLatestVersions(["a", "b", "c", "d", "e", "f", "g"], fetcher, 3);

    expect(peak).toBeLessThanOrEqual(3);
    expect(inFlight).toBe(0);
  });

  it("passes an abortable signal and the registry url to the fetcher", async () => {
    const fetcher = vi.fn<VersionFetcher>(async (_name, _url, signal) => {
      expect(signal.aborted).toBe(false);
      return { version: "1.0.0" };
    });

    await fetchLatestVersions(["react"], fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [name, url, signal] = fetcher.mock.calls[0];
    expect(name).toBe("react");
    expect(url).toBe("https://registry.npmjs.org/react/latest");
    expect((signal as AbortSignal).aborted).toBe(false);
  });

  it("returns an empty list for no packages", async () => {
    expect(await fetchLatestVersions([], okFetcher("1.0.0"))).toEqual([]);
  });
});