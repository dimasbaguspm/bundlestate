import Dexie, { type Table } from "dexie";
import type { BundleStateReport } from "@/lib/types";

export interface StoredReport {
  id: string;
  sourceName: string;
  generatedAt: string;
  /** The full normalized report — a plain, structured-cloneable object. */
  report: BundleStateReport;
}

/**
 * IndexedDB (via Dexie) persistence for reports. Reports can be large, so they
 * are stored whole as structured clones — no truncation, no per-field
 * projection.
 */
class BundleStateDb extends Dexie {
  reports!: Table<StoredReport, string>;

  constructor() {
    super("bundlestate-db");
    this.version(1).stores({
      reports: "id, sourceName, generatedAt",
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

/** All stored reports with their full payload, newest first. */
export async function loadAllReports(): Promise<BundleStateReport[]> {
  const rows = await db.reports.orderBy("generatedAt").reverse().toArray();
  return rows.map((r) => r.report);
}
