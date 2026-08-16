import { Unzip, UnzipInflate, type UnzipFile } from "fflate";

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
