import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDeleteRecordDialog } from "./ConfirmDeleteRecordDialog";

afterEach(() => cleanup());

function setup(pending = false) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmDeleteRecordDialog open title="Delete ABC 123 KJ papers?" pending={pending} onCancel={onCancel} onConfirm={onConfirm} />
  );
  return { onCancel, onConfirm };
}

describe("ConfirmDeleteRecordDialog (IVA-173)", () => {
  it("names the record and uses Coco's copy", () => {
    setup();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete ABC 123 KJ papers?")).toBeInTheDocument();
    expect(screen.getByText("This removes the record for everyone. You can't undo this.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete record" })).toHaveClass("bg-danger");
  });

  it("focuses Cancel by default", async () => {
    setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("confirms on Delete record and cancels on Cancel, Escape and outside click", async () => {
    const { onCancel, onConfirm } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete record" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Escape}");
    fireEvent.click(screen.getByTestId("confirm-delete-overlay"));
    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it("disables both buttons and blocks dismissal while deleting", async () => {
    const { onCancel } = setup(true);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete record" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    fireEvent.click(screen.getByTestId("confirm-delete-overlay"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("stacks full width below sm with Delete last", () => {
    setup();
    const del = screen.getByRole("button", { name: "Delete record" });
    const footer = del.parentElement!;
    expect(footer).toHaveClass("flex-col", "sm:flex-row");
    expect(footer.lastElementChild).toBe(del);
    expect(del).toHaveClass("w-full", "sm:w-auto");
  });
});
