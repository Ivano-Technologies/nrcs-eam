/** IVA-181: the facility delete dialog shows the server's reason inside the dialog, never a raw error. */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { FacilityDeleteDialog } from "../FacilityDeleteDialog";

const mutateAsync = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: { sites: { bulkDelete: { useMutation: () => ({ mutateAsync, isPending: false }) } } },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const HAS_ASSETS = "Move or retire this facility's assets first.";

function setup() {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(<FacilityDeleteDialog facility={{ id: 7, name: "Kano State Branch" }} onClose={onClose} onDeleted={onDeleted} />);
  return { onClose, onDeleted };
}

describe("FacilityDeleteDialog (IVA-181)", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });
  afterEach(cleanup);

  it("blocked by assets: shows Coco's message in the dialog, keeps it open, disables Delete", async () => {
    mutateAsync.mockResolvedValue({
      deleted: 0,
      total: 1,
      failedIds: [7],
      failures: [{ id: 7, reason: "has_assets", message: HAS_ASSETS }],
    });
    const { onClose, onDeleted } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(HAS_ASSETS);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(mutateAsync).toHaveBeenCalledWith({ ids: [7] });
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("no assets: deletes, toasts and hands back to the page", async () => {
    mutateAsync.mockResolvedValue({ deleted: 1, total: 1, failedIds: [], failures: [] });
    const { onDeleted } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Facility deleted");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("unexpected failure: generic message and Try again, never the raw error", async () => {
    mutateAsync.mockRejectedValue(new Error("Failed query: delete from sites ... asset_code is immutable once generated"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't delete this facility. Please try again.");
    expect(alert.textContent).not.toMatch(/immutable|Failed query/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
