import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./home-page";
import { clearReports, saveReport } from "@/db";
import { makeReport } from "@/test/fixtures";

describe("HomePage", () => {
  beforeEach(async () => {
    await clearReports();
  });

  it("renders the dropzone and no recent reports initially", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/drag & drop your bundle/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Recent reports")).not.toBeInTheDocument();
  });

  it("lists persisted reports as links to their detail pages", async () => {
    await saveReport(makeReport("r-1", "one.zip"));
    await saveReport(makeReport("r-2", "two.tar.gz"));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const list = (await screen.findByLabelText("Recent reports")) as HTMLElement;
    const links = list.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/r/r-2");
    expect(links[0]).toHaveTextContent("two.tar.gz");
  });
});