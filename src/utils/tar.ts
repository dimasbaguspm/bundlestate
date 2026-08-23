/** One file extracted from a tar archive. */
export interface UntarEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Minimal ustar/pax tar reader (browser-safe, no deps). fflate dropped tar
 * support, so this parser exists to read npm-style tarballs after gunzip:
 * 512-byte headers, octal/base-256 sizes, GNU long names (`L`) and pax
 * extended headers (`x`/`g` with `path=`/`size=` records). Directories and
 * special files are skipped; only regular files are returned.
 */
export function untar(data: Uint8Array): UntarEntry[] {
  const entries: UntarEntry[] = [];
  const decoder = new TextDecoder();
  let offset = 0;
  let pendingPath: string | null = null;
  let pendingSize: number | null = null;

  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (isAllZero(header)) break;

    const name = readString(header.subarray(0, 100), decoder);
    const prefix = readString(header.subarray(345, 500), decoder);
    const rawSize = parseOctal(header.subarray(124, 136));
    const type = header[156];
    const payload = data.subarray(offset + 512, offset + 512 + rawSize);
    offset += 512 + Math.ceil(rawSize / 512) * 512;

    if (type === 0x00 || type === 0x30) {
      // Regular file.
      const finalName =
        pendingPath ?? (prefix !== "" && prefix !== undefined ? `${prefix}/${name}` : name);
      const finalSize = pendingSize ?? rawSize;
      pendingPath = null;
      pendingSize = null;
      if (finalName !== "") {
        entries.push({ name: finalName, data: payload.slice(0, finalSize) });
      }
    } else if (type === 0x4c) {
      // GNU long name — applies to the next entry.
      pendingPath = readString(payload, decoder);
    } else if (type === 0x78 || type === 0x58 || type === 0x67) {
      // Pax extended header ('x' per-file, 'g' global) — npm tarballs use
      // these for long paths; we accept the record for the next entry only.
      const pax = parsePax(payload, decoder);
      if (pax.path !== undefined) pendingPath = pax.path;
      if (pax.size !== undefined) pendingSize = pax.size;
    } else {
      pendingPath = null;
      pendingSize = null;
    }
  }

  return entries;
}

function parsePax(payload: Uint8Array, decoder: TextDecoder): { path?: string; size?: number } {
  const text = decoder.decode(payload);
  const out: { path?: string; size?: number } = {};
  let i = 0;
  while (i < text.length) {
    const space = text.indexOf(" ", i);
    if (space === -1) break;
    const len = Number.parseInt(text.slice(i, space), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = text.slice(space + 1, i + len - 1);
    const eq = record.indexOf("=");
    if (eq !== -1) {
      const key = record.slice(0, eq);
      const value = record.slice(eq + 1);
      if (key === "path" && value !== "" && value !== "/") out.path = value;
      if (key === "size") {
        const n = Number(value);
        if (Number.isFinite(n)) out.size = n;
      }
    }
    i += len;
  }
  return out;
}

function parseOctal(bytes: Uint8Array): number {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 0 || bytes[end - 1] === 0x20)) end--;
  if (end === 0) return 0;

  if (bytes[0] & 0x80) {
    // GNU base-256 encoding.
    let value = bytes[0] & 0x7f;
    for (let i = 1; i < end; i++) value = value * 256 + bytes[i];
    return value;
  }
  const digits = new TextDecoder().decode(bytes.subarray(0, end)).trim();
  return parseInt(digits, 8) || 0;
}

function readString(bytes: Uint8Array, decoder: TextDecoder): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return decoder.decode(bytes.subarray(0, end));
}

function isAllZero(bytes: Uint8Array): boolean {
  for (const b of bytes) if (b !== 0) return false;
  return true;
}
