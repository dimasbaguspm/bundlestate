import Dexie, { type Table } from "dexie";
import type { BundleStateReport } from "@/lib/types";

export interface StoredReport {
  id: string;
  sourceName: string;
  generatedAt: string;
  /** The full normalized report — a plain, structured-cloneable object. */
  report: BundleStateReport;
}

export interface StoredVersion {
  fullName: string;
  latest: string;
  checkedAt: string;
}

/**
 * IndexedDB (via Dexie) persistence for reports and npm-latest-version
 * caches. Reports can be large, so they are stored whole as structured
 * clones — no truncation, no per-field projection.
 */
class BundleStateDb extends Dexie {
  reports!: Table<StoredReport, string>;
  versions!: Table<StoredVersion, string>;

  constructor() {
    super("bundlestate-db");
    this.version(1).stores({
      reports: "id, sourceName, generatedAt",
      versions: "fullName, checkedAt",
    });
  }
}

const db = new BundleStateDb();

export async function saveReport(report: BundleStateReport): Promise<void> {
  await db.reports.put({
    id: report.id,
    sourceName: report.sourceName,
    generatedAt: report.generatedAt,
    report,
  });
}

export async function loadReport(id: string): Promise<BundleStateReport | undefined> {
  const stored = await db.reports.get(id);
  return stored?.report;
}

export async function deleteReport(id: string): Promise<void> {
  await db.reports.delete(id);
}

export async function clearReports(): Promise<void> {
  await db.reports.clear();
}

/** Light metadata for the home page recent-reports list, newest first. */
export async function listReports(): Promise<
  { id: string; sourceName: string; generatedAt: string }[]
> {
  const rows = await db.reports.orderBy("generatedAt").reverse().toArray();
  return rows.map(({ id, sourceName, generatedAt }) => ({ id, sourceName, generatedAt }));
}

export async function saveVersion(fullName: string, latest: string): Promise<void> {
  await db.versions.put({ fullName, latest, checkedAt: new Date().toISOString() });
}

export async function getVersions(): Promise<Record<string, string>> {
  const rows = await db.versions.toArray();
  return Object.fromEntries(rows.map(({ fullName, latest }) => [fullName, latest]));
}

export async function clearVersions(): Promise<void> {
  await db.versions.clear();
}