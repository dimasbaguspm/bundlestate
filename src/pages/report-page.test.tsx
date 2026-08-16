import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./home-page";
import { ReportPage } from "./report-page";
import { useBundleStore } from "@/state/store";
import { clearReports, saveReport } from "@/db";
import { makeReport } from "@/test/fixtures";

// The D3 treemap needs ResizeObserver/canvas; jsdom has none. Stub the views
// so the page's load/redirect logic is what gets tested here.
vi.mock("@/components/Treemap", () => ({
  Treemap: () => <div data-testid="treemap-mock" />,
}));
vi.mock("@/components/lineage-table", () => ({
  LineageTable: () => <div data-testid="lineage-mock" />,
}));

function renderRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/r/:id" element={<ReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ReportPage", () => {
  beforeEach(async () => {
    useBundleStore.setState({ reports: {}, activeReportId: null });
    await clearReports();
  });

  it("shows a report that is already in the store", () => {
    useBundleStore.getState().addReport(makeReport("r-1", "store.zip"));

    renderRoute("/r/r-1");

    expect(screen.getByLabelText("Report for store.zip")).toBeInTheDocument();
    expect(useBundleStore.getState().activeReportId).toBe("r-1");
  });

  it("loads a persisted report from IndexedDB on refresh", async () => {
    await saveReport(makeReport("r-persisted", "persisted.zip"));

    renderRoute("/r/r-persisted");

    expect(
      await screen.findByLabelText("Report for persisted.zip"),
    ).toBeInTheDocument();
  });

  it("redirects to the landing page with a banner for an unknown id", async () => {
    renderRoute("/r/does-not-exist");

    expect(await screen.findByText(/drop your bundle here/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/Report “does-not-exist” was not found/i),
    ).toBeInTheDocument();
  });
});