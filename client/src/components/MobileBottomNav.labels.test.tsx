import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MobileBottomNav } from "./MobileBottomNav";

afterEach(() => cleanup());

describe("MobileBottomNav labels (Wave B, 390)", () => {
  it("sizes labels on the span so the global mobile button rule cannot enlarge them", () => {
    render(<MobileBottomNav location="/app/facilities" setLocation={() => {}} userRole="admin" />);
    for (const label of ["Dashboard", "Assets", "Facilities", "Maintenance", "More"]) {
      const span = screen.getByText(label);
      expect(span.tagName).toBe("SPAN");
      expect(span.className).toContain("text-[11px]");
      expect(span.className).toContain("max-w-full");
      expect(span.className).toContain("truncate");
    }
  });
});
