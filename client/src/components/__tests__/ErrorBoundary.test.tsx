import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "../ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('relation "assets" does not exist at Object.<anonymous> (db.ts:12:3)');
  return <p>All good</p>;
}

describe("ErrorBoundary (IVA-189)", () => {
  it("shows a friendly page with one Try again action and a ref, never the raw error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("We hit a problem loading this page. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    // One action only.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Go home" })).toBeNull();
    // Support ref shown in muted text and logged with the raw error.
    const ref = screen.getByTestId("error-ref");
    expect(ref.textContent).toMatch(/^Ref: [A-Z0-9]{8}$/);
    expect(ref).toHaveClass("text-muted-foreground");
    const code = ref.textContent!.slice(5);
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes(`ref=${code}`))).toBe(true);
    expect(screen.getByAltText("Nigerian Red Cross Society")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/relation|db\.ts|does not exist/);
    expect(console.error).toHaveBeenCalled();
  });

  it("Try again renders the children again once the problem clears", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    render(
      <ErrorBoundary variant="section">
        <Bomb />
      </ErrorBoundary>
    );
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("clears the error when the reset key changes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    function Harness() {
      const [key, setKey] = useState("/app/a");
      return (
        <>
          <button type="button" onClick={() => setKey("/app/b")}>
            Navigate
          </button>
          <ErrorBoundary variant="section" resetKey={key}>
            <Bomb />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByTestId("error-fallback")).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Navigate" }));
    expect(screen.getByText("All good")).toBeInTheDocument();
  });
});
