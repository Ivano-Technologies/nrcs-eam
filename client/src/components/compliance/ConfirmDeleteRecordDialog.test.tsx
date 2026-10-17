import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ConfirmDeleteRecordDialog, DELETE_RECORD_ERROR } from "./ConfirmDeleteRecordDialog";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

afterEach(() => cleanup());

function setup(pending = false, onConfirm = vi.fn().mockResolvedValue(undefined)) {
  const onCancel = vi.fn();
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

  it("sends one request when Delete is clicked twice in the same instant", async () => {
    let settle!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (settle = r)));
    setup(false, onConfirm);
    const del = screen.getByRole("button", { name: "Delete record" });
    act(() => {
      fireEvent.click(del);
      fireEvent.click(del);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => settle());
  });

  it("shows the error inside the dialog, keeps it open and offers Try again (no toast)", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { onCancel } = setup(false, onConfirm);
    await userEvent.click(screen.getByRole("button", { name: "Delete record" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(DELETE_RECORD_ERROR);
    expect(alert).toHaveClass("text-danger");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    // Error sits above the buttons.
    const footer = screen.getByRole("button", { name: "Try again" }).parentElement!;
    expect(alert.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    // The guard cleared on settle, so Try again sends another request.
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("ComplianceRegister: delete mutations do not toast errors and the dialog gets a promise", () => {
    const src = readFileSync(resolve(process.cwd(), "client/src/pages/Administration/ComplianceRegister.tsx"), "utf8");
    for (const k of ["vehicleDelete", "genDelete", "buildingDelete", "donorDelete"]) {
      const block = src.slice(src.indexOf(`const ${k} = `), src.indexOf("});", src.indexOf(`const ${k} = `)));
      expect(block).toContain("onSuccess");
      expect(block).not.toContain("onError");
      expect(src).toContain(`return ${k}.mutateAsync({ id })`);
    }
  });
});
