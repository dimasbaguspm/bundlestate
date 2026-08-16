import { Blob } from "node:buffer";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { extractZip } from "./zip";

function makeZipStream(entries: Record<string, string>) {
  const bytes = zipSync(
    Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, strToU8(v)])),
  );
  // node:buffer Blob.stream() delivers a real byte stream; the DOM/node
  // ReadableStream generic mismatch is bridged here.
  return {
    stream: new Blob([bytes]).stream() as unknown as ReadableStream<Uint8Array>,
    size: bytes.byteLength,
  };
}

describe("extractZip", () => {
  it("extracts entries with names, sizes and bytes", async () => {
    const { stream } = makeZipStream({
      "index.js": "console.log(1);",
      "index.js.map": JSON.stringify({ sources: ["a.js"] }),
    });

    const entries = await extractZip(stream);

    expect(entries.map((e) => e.name)).toEqual(["index.js", "index.js.map"]);
    const js = entries.find((e) => e.name === "index.js")!;
    expect(js.sizeBytes).toBe("console.log(1);".length);
    expect(new TextDecoder().decode(js.bytes)).toBe("console.log(1);");
  });

  it("reports read progress from 0 to 1", async () => {
    const { stream, size } = makeZipStream({
      "a.js": "x".repeat(1000),
      "b.js": "y".repeat(1000),
    });
    const onProgress = vi.fn();

    await extractZip(stream, { onProgress, expectedBytes: size });

    expect(onProgress).toHaveBeenCalled();
    const values = onProgress.mock.calls.map(([f]) => f as number);
    expect(values[0]).toBeGreaterThan(0);
    expect(values.at(-1)).toBe(1);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const { stream } = makeZipStream({ "a.js": "x" });
    const controller = new AbortController();
    controller.abort();

    await expect(extractZip(stream, { signal: controller.signal })).rejects.toThrow("Aborted");
  });

  it("rejects with AbortError when aborted mid-stream", async () => {
    const { stream, size } = makeZipStream({ "a.js": "x".repeat(100) });
    const controller = new AbortController();

    const promise = extractZip(stream, {
      signal: controller.signal,
      expectedBytes: size,
    });
    queueMicrotask(() => controller.abort());

    await expect(promise).rejects.toThrow("Aborted");
  });

  it("rejects when the shouldAbort predicate reports abort", async () => {
    const { stream, size } = makeZipStream({ "a.js": "x".repeat(100) });
    const controller = new AbortController();

    const promise = extractZip(stream, {
      expectedBytes: size,
      shouldAbort: () => controller.signal.aborted,
    });
    queueMicrotask(() => controller.abort());

    await expect(promise).rejects.toThrow("Aborted");
  });

  it("returns an empty list for an empty zip", async () => {
    const bytes = zipSync({});
    const entries = await extractZip(
      new Blob([bytes]).stream() as unknown as ReadableStream<Uint8Array>,
    );
    expect(entries).toEqual([]);
  });
});
