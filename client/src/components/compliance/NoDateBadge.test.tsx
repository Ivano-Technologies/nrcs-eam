import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { NoDateBadge } from "./NoDateBadge";

describe("NoDateBadge (IVA-168)", () => {
  it("is a grey dashed marker with a text label, never red", () => {
    render(<NoDateBadge />);
    const badge = screen.getByTestId("status-no-date");
    expect(badge).toHaveTextContent("No date");
    expect(badge).toHaveClass("bg-status-chip", "text-muted-foreground", "border-dashed", "border-status-none");
    expect(badge.className).not.toMatch(/red|danger/);
  });
});
