import type { StaticFile, StaticFileType } from "./types";
import { toBase64, type ZipEntry } from "./zip";

const IGNORED = /(^|\/)(node_modules|\.git)(\/|$)/;
const RAW_BYTES_CAP = 512 * 1024; // keep the report payload sane

const TYPE_BY_EXT: Record<string, StaticFileType> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  svg: "image",
  ico: "image",
  woff: "font",
  woff2: "font",
  ttf: "font",
  otf: "font",
  eot: "font",
  mp4: "video",
  webm: "video",
  ogv: "video",
  mov: "video",
  mp3: "audio",
  ogg: "audio",
  wav: "audio",
  m4a: "audio",
  json: "json",
  css: "css",
  txt: "text",
  md: "text",
  xml: "text",
  yaml: "text",
  yml: "text",
};

/** Categorize a static asset path by its extension. */
export function fileType(path: string): StaticFileType {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "other";
  const ext = path.slice(dot + 1).toLowerCase();
  return TYPE_BY_EXT[ext] ?? "other";
}

/**
 * Collect the non-JS/HTML static assets from an archive: anything outside
 * `node_modules` that is not a script, source map, HTML page, or lock/meta
 * file. Used to surface shipped images, fonts, css, json and other assets.
 */
export function collectStaticFiles(entries: ZipEntry[]): StaticFile[] {
  const files: StaticFile[] = [];
  for (const entry of entries) {
    if (!isStatic(entry.name)) continue;
    let raw: string | undefined;
    if (entry.bytes.length <= RAW_BYTES_CAP) {
      raw = toBase64(entry.bytes);
    }
    files.push({
      path: entry.name,
      sizeBytes: entry.sizeBytes,
      type: fileType(entry.name),
      rawBytes: raw,
    });
  }
  return files.sort((a, b) => b.sizeBytes - a.sizeBytes || a.path.localeCompare(b.path));
}

function isStatic(name: string): boolean {
  if (IGNORED.test(name)) return false;
  if (name.endsWith("/")) return false;
  if (name.endsWith(".map")) return false;
  if (/\.(js|mjs|cjs|html?)$/i.test(name)) return false;
  if (/package\.json|pnpm-lock|yarn\.lock|package-lock/i.test(name)) return false;
  return true;
}

/** Static files grouped by type, largest type first. */
export function buildFileGroups(files: StaticFile[]): {
  type: StaticFileType;
  files: StaticFile[];
  totalBytes: number;
}[] {
  const byType = new Map<StaticFileType, StaticFile[]>();
  for (const file of files) {
    if (!byType.has(file.type)) byType.set(file.type, []);
    byType.get(file.type)!.push(file);
  }
  return [...byType.entries()]
    .map(([type, group]) => ({
      type,
      files: group.sort((a, b) => b.sizeBytes - a.sizeBytes || a.path.localeCompare(b.path)),
      totalBytes: group.reduce((s, f) => s + f.sizeBytes, 0),
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes || a.type.localeCompare(b.type));
}
