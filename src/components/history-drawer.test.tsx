import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { HistoryDrawer } from "./history-drawer";
import { clearReports, saveReport } from "@/db";
import { makeReport } from "@/test/fixtures";

function Probe() {
  const nav = useNavigate();
  return <button onClick={() => nav("/probe")}>probe</button>;
}

describe("HistoryDrawer", () => {
  beforeEach(async () => {
    await clearReports();
  });

  it("shows nothing when closed and lists reports when opened", async () => {
    await saveReport(makeReport("r-1", "one.zip"));
    await saveReport(makeReport("r-2", "two.tar.gz"));

    const { rerender } = render(
      <MemoryRouter>
        <HistoryDrawer open={false} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("History")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <HistoryDrawer open onClose={() => {}} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("one.zip")).toBeInTheDocument();
    expect(screen.getByText("two.tar.gz")).toBeInTheDocument();
  });

  it("navigates to a report when opened", async () => {
    await saveReport(makeReport("r-nav", "nav.zip"));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HistoryDrawer open onClose={() => {}} />} />
          <Route path="/r/:id" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("nav.zip"));
    expect(await screen.findByText("probe")).toBeInTheDocument();
  });
});
