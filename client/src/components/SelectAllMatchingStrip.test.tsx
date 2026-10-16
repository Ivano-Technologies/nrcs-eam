import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectAllMatchingStrip } from "./SelectAllMatchingStrip";
import { chunk, formatCount } from "@/lib/formatCount";

afterEach(() => cleanup());

describe("SelectAllMatchingStrip", () => {
  it("is hidden until the whole page is ticked and more rows match", () => {
    const { container } = render(
      <SelectAllMatchingStrip pageCount={50} matchingCount={1234} pageFullySelected={false} allMatchingSelected={false} onSelectAllMatching={() => {}} onClearSelection={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers select all matching with thousands separators, then clear", async () => {
    const onAll = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(
      <SelectAllMatchingStrip pageCount={50} matchingCount={1234} pageFullySelected allMatchingSelected={false} onSelectAllMatching={onAll} onClearSelection={onClear} />
    );
    expect(screen.getByTestId("select-all-matching-strip")).toHaveTextContent("All 50 on this page are selected. Select all 1,234 matching");
    await userEvent.click(screen.getByRole("button", { name: "Select all 1,234 matching" }));
    expect(onAll).toHaveBeenCalledTimes(1);
    rerender(
      <SelectAllMatchingStrip pageCount={50} matchingCount={1234} pageFullySelected allMatchingSelected onSelectAllMatching={onAll} onClearSelection={onClear} />
    );
    expect(screen.getByTestId("select-all-matching-strip")).toHaveTextContent("All 1,234 selected. Clear selection");
    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("hides when everything matching already fits on the page", () => {
    const { container } = render(
      <SelectAllMatchingStrip pageCount={8} matchingCount={8} pageFullySelected allMatchingSelected={false} onSelectAllMatching={() => {}} onClearSelection={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("formatCount and chunk", () => {
  it("formats and chunks", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
