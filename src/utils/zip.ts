import { gunzipSync, Unzip, UnzipInflate, type UnzipFile } from "fflate";
import { untar } from "./tar";

export interface ZipEntry {
  name: string;
  sizeBytes: number;
  bytes: Uint8Array;
}

export interface ExtractZipOptions {
  /** Total bytes expected from the stream; enables `onProgress` fractions. */
  expectedBytes?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Async abort predicate (e.g. a comlink-proxied abort handle). */
  shouldAbort?: () => boolean | Promise<boolean>;
}

/**
 * Stream-extract a zip from a `ReadableStream` using fflate's streaming
 * `Unzip`, reporting read progress and honouring abort signals. Entries are
 * only ever held inside this worker — none of their paths leave the thread.
 */
export async function extractZip(
  stream: ReadableStream<Uint8Array>,
  options: ExtractZipOptions = {},
): Promise<ZipEntry[]> {
  const { expectedBytes, onProgress, signal, shouldAbort } = options;
  if (signal?.aborted || (await shouldAbort?.())) throw abortError();

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  const entries = new Map<string, ZipEntry>();
  let streamError: Error | null = null;

  unzip.onfile = (file: UnzipFile) => {
    const chunks: Uint8Array[] = [];
    file.ondata = (err, data, final) => {
      if (err) {
        streamError = new Error(`Failed to decompress ${file.name}: ${err.message}`);
        return;
      }
      chunks.push(data);
      if (final) {
        const bytes = concatBytes(chunks);
        entries.set(file.name, { name: file.name, sizeBytes: bytes.length, bytes });
      }
    };
    file.start();
  };

  const reader = stream.getReader();
  const onAbort = () => {
    void reader.cancel();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    let bytesRead = 0;
    for (;;) {
      if (signal?.aborted || (await shouldAbort?.())) throw abortError();
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      unzip.push(value, false);
      if (streamError) throw streamError;
      if (expectedBytes && onProgress) {
        onProgress(Math.min(1, bytesRead / expectedBytes));
      }
    }
    unzip.push(new Uint8Array(0), true);
    if (streamError) throw streamError;
    if (signal?.aborted) throw abortError();
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

/**
 * Encode raw bytes as a base64 string, safe for binary data and large arrays.
 * Uses `btoa` in the browser/worker and `Buffer` under Node (tests), building
 * the binary string in chunks to avoid call-stack overflow on big inputs.
 */
export function toBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

/** Reverse of {@link toBase64}: base64 string -> bytes. */
export function fromBase64(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

const ARCHIVE_EXTENSIONS = [".zip", ".tar.gz", ".tgz", ".gz"] as const;

/** True when the file name matches a supported archive extension. */
export function isSupportedArchiveName(name: string): boolean {
  const lower = name.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Extract any supported archive from a `ReadableStream`: `.zip`, `.tar.gz`
 * / `.tgz` (gunzip + untar) and single-payload `.gz`. Unsupported names are
 * rejected up front with a clear message. Progress mirrors `extractZip`:
 * read phase 0→0.9, decompress stage 0.9→1 (only when `expectedBytes` is
 * known).
 */
export async function extractArchive(
  name: string,
  stream: ReadableStream<Uint8Array>,
  options: ExtractZipOptions = {},
): Promise<ZipEntry[]> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return extractZip(stream, options);
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    return extractTarGz(stream, options);
  }
  if (lower.endsWith(".gz")) return extractGzip(name, stream, options);
  throw new Error(`Unsupported archive format: ${name}`);
}

/** Stream-collect compressed bytes, reporting read progress (0→0.9). */
async function collectBytes(
  stream: ReadableStream<Uint8Array>,
  options: ExtractZipOptions,
): Promise<Uint8Array> {
  const { expectedBytes, onProgress, signal, shouldAbort } = options;
  if (signal?.aborted || (await shouldAbort?.())) throw abortError();

  const reader = stream.getReader();
  const onAbort = () => {
    void reader.cancel();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const chunks: Uint8Array[] = [];
    let bytesRead = 0;
    for (;;) {
      if (signal?.aborted || (await shouldAbort?.())) throw abortError();
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      bytesRead += value.byteLength;
      if (expectedBytes && onProgress) {
        onProgress(Math.min(0.9, (bytesRead / expectedBytes) * 0.9));
      }
    }
    return concatBytes(chunks);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

async function extractTarGz(
  stream: ReadableStream<Uint8Array>,
  options: ExtractZipOptions,
): Promise<ZipEntry[]> {
  const { signal, shouldAbort, onProgress } = options;
  const bytes = await collectBytes(stream, options);
  if (signal?.aborted || (await shouldAbort?.())) throw abortError();
  onProgress?.(0.9);

  const inflated = gunzipSync(bytes);
  if (signal?.aborted || (await shouldAbort?.())) throw abortError();
  onProgress?.(0.95);

  const entries = untar(inflated).map((file) => ({
    name: file.name,
    sizeBytes: file.data.byteLength,
    bytes: file.data,
  }));
  onProgress?.(1);
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function extractGzip(
  name: string,
  stream: ReadableStream<Uint8Array>,
  options: ExtractZipOptions,
): Promise<ZipEntry[]> {
  const { signal, shouldAbort, onProgress } = options;
  const bytes = await collectBytes(stream, options);
  if (signal?.aborted || (await shouldAbort?.())) throw abortError();
  onProgress?.(0.9);

  const inflated = gunzipSync(bytes);
  const entryName = name.replace(/\.gz$/i, "");
  onProgress?.(1);
  return [{ name: entryName, sizeBytes: inflated.byteLength, bytes: inflated }];
}
