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
