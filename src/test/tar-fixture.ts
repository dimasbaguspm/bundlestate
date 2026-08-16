import type { UntarEntry } from "@/lib/tar";

/**
 * Minimal in-memory ustar tar writer for tests — no binary fixtures, no
 * third-party tar dependency. Supports regular files, directories, and pax
 * extended headers (`path=` records) for long names.
 */

const enc = new TextEncoder();

function writeString(target: Uint8Array, offset: number, length: number, value: string) {
  const bytes = enc.encode(value).subarray(0, length);
  target.set(bytes, offset);
  for (let i = bytes.length; i < length; i++) target[offset + i] = 0;
}

function writeOctal(target: Uint8Array, offset: number, length: number, value: number) {
  writeString(target, offset, length, value.toString(8).padStart(length - 1, "0"));
}

function tarHeader(name: string, size: number, type: number): Uint8Array {
  const block = new Uint8Array(512);
  writeString(block, 0, 100, name);
  writeOctal(block, 100, 8, 0o644);
  writeOctal(block, 108, 8, 0o644);
  writeOctal(block, 124, 12, size);
  writeOctal(block, 136, 12, 0);
  block[156] = type;
  writeString(block, 257, 6, "ustar ");
  writeString(block, 263, 2, "00");
  block.fill(0x20, 148, 156);
  writeOctal(block, 148, 8, block.reduce((sum, b) => sum + b, 0));
  return block;
}

function fileBlock(name: string, content: string): Uint8Array {
  const data = enc.encode(content);
  const padded = Math.ceil(data.length / 512) * 512;
  const out = new Uint8Array(512 + padded);
  out.set(tarHeader(name, data.length, 0x30), 0); // '0' regular file
  out.set(data, 512);
  return out;
}

/** `LEN key=value\n` where LEN covers the whole record (pax spec). */
export function paxRecord(key: string, value: string): string {
  const base = key.length + value.length + 3; // " ", "=", "\n"
  let len = base + String(base).length;
  if (String(len).length !== String(base).length) len = base + String(len).length;
  return `${len} ${key}=${value}\n`;
}

function paxHeader(record: string): Uint8Array {
  const recordBytes = enc.encode(record);
  const padded = Math.ceil(recordBytes.length / 512) * 512;
  const out = new Uint8Array(512 + padded);
  out.set(tarHeader("PaxHeaders.0/bundle", recordBytes.length, 0x78), 0); // 'x'
  out.set(recordBytes, 512);
  return out;
}

export interface TarFixtureFile {
  name: string;
  content: string;
  /** Emit a pax `path=` header before this file (long names). */
  paxPath?: boolean;
}

/**
 * Compose tar bytes (file blocks + two zero end blocks).
 * Options: `dirs` emits a directory header before each file's parent dir,
 * mirroring how real tarballs (npm) are laid out.
 */
export function buildTar(
  files: TarFixtureFile[],
  options: { dirs?: string[] } = {},
): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const dir of options.dirs ?? []) {
    blocks.push(tarHeader(dir.endsWith("/") ? dir : `${dir}/`, 0, 0x35)); // '5'
  }
  for (const file of files) {
    if (file.paxPath) blocks.push(paxHeader(paxRecord("path", file.name)));
    blocks.push(fileBlock(file.paxPath ? "dummy-name" : file.name, file.content));
  }
  const size = blocks.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(size + 1024);
  let offset = 0;
  for (const block of blocks) {
    out.set(block, offset);
    offset += block.length;
  }
  return out;
}

export const decodeEntry = (entry: UntarEntry) => new TextDecoder().decode(entry.data);