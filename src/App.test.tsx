import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { useBundleStore } from "@/state/store";
import { makeReport } from "@/test/fixtures";

const runParseJobMock = vi.fn();
vi.mock("@/state/runJob", () => ({
  runParseJob: (...args: unknown[]) => runParseJobMock(...args),
  abortJob: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    runParseJobMock.mockClear();
    useBundleStore.setState({ jobs: {}, reports: {}, activeReportId: null, versions: {} });
  });

  it("renders the landing page with the dropzone", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /bundlestate/i })).toBeInTheDocument();
    expect(screen.getByText(/drag & drop your bundle/i)).toBeInTheDocument();
  });

  it("shows no report panels before any upload", () => {
    render(<App />);
    expect(screen.queryAllByLabelText(/report for/i)).toHaveLength(0);
  });

  it("navigates to the report page when a job finishes", async () => {
    render(<App />);

    const file = new File(["content"], "demo.zip", { type: "application/zip" });
    fireEvent.drop(screen.getByRole("button", { name: /drop a bundle zip here/i }), {
      dataTransfer: { files: [file] },
    });

    expect(runParseJobMock).toHaveBeenCalledTimes(1);
    const [, , options] = runParseJobMock.mock.calls[0] as [
      File,
      string,
      { onDone: (id: string) => void },
    ];
    expect(typeof options.onDone).toBe("function");

    // Simulate the real pipeline: report lands in the store, then onDone fires.
    const report = makeReport("r-nav", "nav.zip");
    useBundleStore.getState().addReport(report);
    options.onDone(report.id);

    expect(await screen.findByLabelText("Report for nav.zip")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/r/r-nav");
  });
});