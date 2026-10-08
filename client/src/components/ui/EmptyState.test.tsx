import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState, HtmlTableEmptyState } from "./EmptyState";

afterEach(() => cleanup());

describe("EmptyState (Wave B6)", () => {
  it("renders title, body and action", () => {
    render(<EmptyState title="No receipts yet" body="Receipts appear here once a GRN is posted." action={<button type="button">New receipt</button>} />);
    expect(screen.getByText("No receipts yet")).toBeInTheDocument();
    expect(screen.getByText("Receipts appear here once a GRN is posted.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New receipt" })).toBeInTheDocument();
  });

  it("spans the whole table in a single cell", () => {
    const { container } = render(
      <table>
        <tbody>
          <HtmlTableEmptyState colSpan={7} title="No assets match these filters" />
        </tbody>
      </table>
    );
    const cell = container.querySelector("td");
    expect(cell?.getAttribute("colspan")).toBe("7");
    expect(cell?.textContent).toContain("No assets match these filters");
  });
});
