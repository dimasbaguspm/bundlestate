import { Blob } from "node:buffer";
import { gzipSync, strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { extractArchive, extractZip, isSupportedArchiveName } from "./zip";
import { buildTar } from "@/test/tar-fixture";

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

function makeByteStream(bytes: Uint8Array) {
  return {
    stream: new Blob([bytes]).stream() as unknown as ReadableStream<Uint8Array>,
    size: bytes.byteLength,
  };
}

function makeTarGzStream(entries: Array<{ name: string; content: string }>) {
  const tar = buildTar(entries);
  return makeByteStream(gzipSync(tar));
}

function makeGzStream(content: string) {
  return makeByteStream(gzipSync(strToU8(content)));
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

describe("isSupportedArchiveName", () => {
  it("accepts zip, tar.gz, tgz and gz names (case-insensitive)", () => {
    expect(isSupportedArchiveName("bundle.zip")).toBe(true);
    expect(isSupportedArchiveName("bundle.ZIP")).toBe(true);
    expect(isSupportedArchiveName("bundle.tar.gz")).toBe(true);
    expect(isSupportedArchiveName("bundle.tgz")).toBe(true);
    expect(isSupportedArchiveName("bundle.js.gz")).toBe(true);
    expect(isSupportedArchiveName("bundle.rar")).toBe(false);
    expect(isSupportedArchiveName("bundle.tar")).toBe(false);
  });
});

describe("extractArchive", () => {
  it("dispatches .zip to the zip extractor", async () => {
    const { stream } = makeZipStream({ "dist/a.js": "1" });
    const entries = await extractArchive("bundle.zip", stream);
    expect(entries.map((e) => e.name)).toEqual(["dist/a.js"]);
  });

  it("gunzips and untars .tar.gz archives", async () => {
    const { stream } = makeTarGzStream([
      { name: "package/dist/a.js", content: "console.log(1);" },
      { name: "package/node_modules/x/index.js", content: "export const x = 1;" },
    ]);

    const entries = await extractArchive("bundle.tar.gz", stream);

    expect(entries.map((e) => e.name)).toEqual([
      "package/dist/a.js",
      "package/node_modules/x/index.js",
    ]);
    expect(new TextDecoder().decode(entries[0].bytes)).toBe("console.log(1);");
    expect(entries[0].sizeBytes).toBe(15);
  });

  it("handles the .tgz shorthand", async () => {
    const { stream } = makeTarGzStream([{ name: "a.js", content: "1" }]);
    const entries = await extractArchive("bundle.tgz", stream);
    expect(entries.map((e) => e.name)).toEqual(["a.js"]);
  });

  it("gunzips a single .gz payload named after the base file", async () => {
    const { stream } = makeGzStream("console.log('gzip');");
    const entries = await extractArchive("main.js.gz", stream);

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("main.js");
    expect(new TextDecoder().decode(entries[0].bytes)).toBe("console.log('gzip');");
  });

  it("rejects unsupported formats with a clear message", async () => {
    const { stream } = makeByteStream(strToU8("not really an archive"));
    await expect(extractArchive("bundle.rar", stream)).rejects.toThrow(
      "Unsupported archive format: bundle.rar",
    );
  });

  it("reports read progress up to 1 and stays monotonic for tar.gz", async () => {
    const { stream, size } = makeTarGzStream([
      { name: "a.js", content: "x".repeat(2000) },
      { name: "b.js", content: "y".repeat(2000) },
    ]);
    const onProgress = vi.fn();

    await extractArchive("bundle.tar.gz", stream, { onProgress, expectedBytes: size });

    expect(onProgress).toHaveBeenCalled();
    const values = onProgress.mock.calls.map(([f]) => f as number);
    // Read phase stays under 0.9; the decompress stage finishes at 1.
    expect(values[0]).toBeGreaterThan(0);
    expect(values.at(-1)).toBe(1);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it("rejects with AbortError when aborted mid-read of a tar.gz", async () => {
    const { stream, size } = makeTarGzStream([
      { name: "a.js", content: "x".repeat(100) },
    ]);
    const controller = new AbortController();

    const promise = extractArchive("bundle.tar.gz", stream, {
      expectedBytes: size,
      signal: controller.signal,
    });
    queueMicrotask(() => controller.abort());

    await expect(promise).rejects.toThrow("Aborted");
  });
});
