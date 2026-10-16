import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkActionsToolbar } from "./BulkActionsToolbar";

afterEach(() => {
  cleanup();
});

describe("BulkActionsToolbar", () => {
  it("renders nothing when nothing is selected", () => {
    render(<BulkActionsToolbar selectedCount={0} onClearSelection={() => {}} onDelete={() => {}} />);
    expect(screen.queryByTestId("bulk-actions-toolbar")).toBeNull();
  });

  it("shows the count and only the actions provided", async () => {
    const onDelete = vi.fn();
    const onClear = vi.fn();
    render(
      <BulkActionsToolbar selectedCount={3} itemLabel="assets" onClearSelection={onClear} onDelete={onDelete} />
    );
    expect(screen.getByRole("toolbar", { name: "Bulk actions for 3 selected assets" })).toBeInTheDocument();
    expect(screen.getByTestId("bulk-actions-count")).toHaveTextContent("3 selected");
    expect(screen.queryByTestId("bulk-actions-export")).toBeNull();
    await userEvent.click(screen.getByTestId("bulk-actions-delete"));
    await userEvent.click(screen.getByTestId("bulk-actions-clear"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("disables actions while pending but keeps Clear usable", () => {
    render(
      <BulkActionsToolbar selectedCount={1} onClearSelection={() => {}} onDelete={() => {}} onExport={() => {}} disabled />
    );
    expect(screen.getByTestId("bulk-actions-delete")).toBeDisabled();
    expect(screen.getByTestId("bulk-actions-export")).toBeDisabled();
    expect(screen.getByTestId("bulk-actions-clear")).not.toBeDisabled();
  });
});

describe("BulkActionsToolbar layout", () => {
  it("has an icon-only clear button labelled for screen readers and a spacer", () => {
    render(<BulkActionsToolbar selectedCount={2} onClearSelection={() => {}} onExport={() => {}} />);
    expect(screen.getByRole("button", { name: "Clear selection" })).toBeInTheDocument();
    expect(screen.getByTestId("bulk-actions-spacer")).toBeInTheDocument();
  });

  it("keeps actions on one row below md only when nowrapActions is set", () => {
    const { unmount } = render(<BulkActionsToolbar selectedCount={2} onClearSelection={() => {}} onExport={() => {}} nowrapActions />);
    expect(screen.getByTestId("bulk-actions-row")).toHaveClass("flex-nowrap", "md:flex-wrap");
    unmount();
    render(<BulkActionsToolbar selectedCount={2} onClearSelection={() => {}} onExport={() => {}} />);
    expect(screen.getByTestId("bulk-actions-row")).toHaveClass("flex-wrap");
    expect(screen.getByTestId("bulk-actions-row")).not.toHaveClass("flex-nowrap");
  });

  it("sizes the spacer from the measured bar height and cleans up on unmount", () => {
    const orig = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { height: this.getAttribute("role") === "toolbar" ? 176 : 0, width: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
    };
    try {
      const { unmount } = render(<BulkActionsToolbar selectedCount={2} onClearSelection={() => {}} onExport={() => {}} />);
      expect(document.documentElement.style.getPropertyValue("--bulk-bar-h")).toBe("176px");
      expect(screen.getByTestId("bulk-actions-spacer").style.height).toContain("16px");
      unmount();
      expect(document.documentElement.style.getPropertyValue("--bulk-bar-h")).toBe("");
    } finally {
      HTMLElement.prototype.getBoundingClientRect = orig;
    }
  });
});
