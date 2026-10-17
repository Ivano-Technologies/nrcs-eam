/** IVA-181: the facility delete dialog shows the server's reason inside the dialog, never a raw error. */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { FACILITY_HAS_ASSETS_MESSAGE, FACILITY_HAS_CHILDREN_MESSAGE } from "@shared/facilityDelete";
import { FacilityDeleteDialog } from "../FacilityDeleteDialog";

const mutateAsync = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: { sites: { bulkDelete: { useMutation: () => ({ mutateAsync, isPending: false }) } } },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const HAS_ASSETS = FACILITY_HAS_ASSETS_MESSAGE;

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

  it("blocked by assets: a notice with the reason and a single Close, no Delete or undo line", async () => {
    mutateAsync.mockResolvedValue({
      deleted: 0,
      total: 1,
      failedIds: [7],
      failures: [{ id: 7, reason: "has_assets", message: HAS_ASSETS }],
    });
    const { onClose, onDeleted } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText("You can't delete this facility yet")).toBeInTheDocument();
    const reason = within(dialog).getByTestId("facility-delete-blocked-reason");
    expect(reason).toHaveTextContent(HAS_ASSETS);
    expect(reason).not.toHaveClass("text-danger");
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(dialog.textContent).not.toContain("cannot be undone");
    expect(within(dialog).queryByRole("button", { name: "Delete" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Cancel" })).toBeNull();
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Close");
    expect(buttons[0]).not.toHaveClass("bg-destructive");
    expect(buttons[0]).not.toHaveClass("bg-danger");
    expect(mutateAsync).toHaveBeenCalledWith({ ids: [7] });
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();

    await userEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocked title is one plain text node in the dialog's normal title weight (Coco)", async () => {
    mutateAsync.mockResolvedValue({
      deleted: 0,
      total: 1,
      failedIds: [7],
      failures: [{ id: 7, reason: "has_assets", message: HAS_ASSETS }],
    });
    setup();
    const normalTitle = screen.getByRole("heading", { name: "Delete facility" });
    const normalClass = normalTitle.className;
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const title = await screen.findByRole("heading", { name: "You can't delete this facility yet" });
    // One text node, no inline elements, so nothing can render part of it in another weight.
    expect(title.childNodes).toHaveLength(1);
    expect(title.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(title.children).toHaveLength(0);
    expect(title.textContent).toBe("You can't delete this facility yet");
    // Same classes as the normal Delete facility title: font-semibold and no other weight.
    expect(title.className).toBe(normalClass);
    expect(title).toHaveClass("font-semibold");
    expect(title.className).not.toMatch(/font-(thin|extralight|light|normal|medium|bold|extrabold|black)\b/);
  });

  it("blocked by child facilities: same notice", async () => {
    const CHILDREN = FACILITY_HAS_CHILDREN_MESSAGE;
    mutateAsync.mockResolvedValue({
      deleted: 0,
      total: 1,
      failedIds: [7],
      failures: [{ id: 7, reason: "has_children", message: CHILDREN }],
    });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("You can't delete this facility yet")).toBeInTheDocument();
    expect(screen.getByTestId("facility-delete-blocked-reason")).toHaveTextContent(CHILDREN);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("unblocked: the delete dialog keeps its copy and red Delete", () => {
    setup();
    expect(screen.getByText("Delete facility")).toBeInTheDocument();
    expect(screen.getByText("Delete Kano State Branch? This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-destructive");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
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
