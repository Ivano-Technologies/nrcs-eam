import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { DATE_INPUT_HINT, DateHint, formatDate, formatDateRange, formatDateTime, formatEmpty, formatEnumLabel } from "./format";

describe("formatDate and formatDateTime (Wave B13)", () => {
  it("formats dates as day, short month, year", () => {
    expect(formatDate(new Date(2026, 9, 8, 10, 4, 19))).toBe("8 Oct 2026");
    expect(formatDate("2026-10-08")).toBe("8 Oct 2026");
  });

  it("formats date times without seconds or AM/PM", () => {
    const text = formatDateTime(new Date(2026, 9, 8, 10, 4, 19));
    expect(text).toBe("8 Oct 2026, 10:04");
    expect(text).not.toMatch(/AM|PM|:19/);
  });

  it("returns blank for missing values and passes unparseable text through", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDateTime(null)).toBe("");
    expect(formatDate("Pending")).toBe("Pending");
  });

  it("joins ranges with 'to', never a dash", () => {
    expect(formatDateRange("2026-10-01", "2026-10-08")).toBe("1 Oct 2026 to 8 Oct 2026");
    expect(formatDateRange("2026-10-01", null)).toBe("1 Oct 2026");
  });

  it("shows the DD/MM/YYYY hint", () => {
    expect(DATE_INPUT_HINT).toBe("DD/MM/YYYY");
    const { container } = render(<DateHint />);
    expect(container.textContent).toBe("DD/MM/YYYY");
  });
});

describe("formatEnumLabel (Wave B8)", () => {
  it.each([
    ["relief_item", "Relief item"],
    ["login", "Signed in"],
    ["totalAssetValue", "Total asset value"],
    ["ppe", "PPE"],
    ["national_hq", "National HQ"],
    ["in_transit", "In transit"],
    ["transfer_out", "Transfer out"],
    ["GRN", "GRN"],
  ])("%s → %s", (raw, label) => {
    expect(formatEnumLabel(raw)).toBe(label);
  });

  it("returns blank for empty values", () => {
    expect(formatEnumLabel(null)).toBe("");
    expect(formatEnumLabel("  ")).toBe("");
  });
});

describe("formatEmpty (Wave B10)", () => {
  it("renders a muted Not set instead of a dash", () => {
    const { container } = render(<>{formatEmpty(null)}</>);
    expect(container.textContent).toBe("Not set");
    expect(container.querySelector("span")?.className).toContain("text-muted-foreground");
    const blank = render(<>{formatEmpty("  ")}</>);
    expect(blank.container.textContent).toBe("Not set");
  });

  it("passes real values through", () => {
    const { container } = render(<>{formatEmpty("Abuja Nigeria")}</>);
    expect(container.textContent).toBe("Abuja Nigeria");
  });
});
