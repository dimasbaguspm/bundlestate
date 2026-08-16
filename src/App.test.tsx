import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the landing page with the dropzone", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /bundlestate/i })).toBeInTheDocument();
    expect(screen.getByText(/drag & drop your bundle/i)).toBeInTheDocument();
  });

  it("shows no report panels before any upload", () => {
    render(<App />);
    expect(screen.queryAllByLabelText(/report for/i)).toHaveLength(0);
  });
});
