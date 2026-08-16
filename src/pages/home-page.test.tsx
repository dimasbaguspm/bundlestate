import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./home-page";
import { clearReports } from "@/db";

describe("HomePage", () => {
  beforeEach(async () => {
    await clearReports();
  });

  it("renders the full dropzone with no reports section", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/drag & drop your bundle/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /drop a bundle zip here/i })).toBeInTheDocument();
    // Recent reports now live in the history drawer, not the landing page.
    expect(screen.queryByLabelText("Recent reports")).not.toBeInTheDocument();
  });
});
