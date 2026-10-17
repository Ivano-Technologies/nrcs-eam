/**
 * Insurance register delete confirm (Chief, #151): Delete on a policy row opens the shared register confirm
 * dialog instead of deleting on one click. Cancel keeps the policy; confirming calls the delete once.
 * A failed delete shows the generic message, never the raw server error. The add policy dialog has no
 * DD/MM/YYYY hint beside its date fields (Coco); the native date input shows the format.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteSpy = vi.fn();
const state = { pending: false, fail: false };
let onSuccessCb: (() => void) | undefined;

const ROWS = [
  {
    id: 7,
    assetId: 3,
    siteId: 1,
    assetOrProperty: "Toyota Hilux",
    assetCode: "NRCS-VEH-0007",
    facilityName: "Abuja NHQ",
    insuranceType: "Vehicle",
    insurer: "Leadway",
    policyNumber: "POL-7",
    insuredValueNgn: 1000,
    annualPremiumNgn: 100,
    policyStart: "2026-01-01",
    policyEnd: "2027-01-01",
    daysToRenewal: 76,
    status: "active" as const,
    notes: null,
  },
];

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    trpc: {
      useUtils: () => ({ insuranceRecords: { list: { invalidate: vi.fn() } } }),
      insuranceRecords: {
        list: { useQuery: () => ({ data: ROWS }) },
        create: { useMutation: mutation },
        delete: {
          useMutation: (opts?: { onSuccess?: () => void }) => {
            onSuccessCb = opts?.onSuccess;
            const run = async (input: { id: number }) => {
              deleteSpy(input);
              if (state.fail) throw new Error("violates foreign key constraint insurance_records_pkey");
              onSuccessCb?.();
              return { success: true };
            };
            return { mutate: (input: { id: number }) => void run(input).catch(() => undefined), mutateAsync: run, isPending: state.pending };
          },
        },
        exportExcel: { useMutation: mutation },
      },
      sites: { list: { useQuery: () => ({ data: [] }) } },
    },
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" } }) }));

import { DELETE_RECORD_ERROR } from "@/components/compliance/ConfirmDeleteRecordDialog";
import { InsuranceRegisterContent, insuranceDeleteLabel } from "../InsuranceRegister";

function renderPage() {
  const loc = memoryLocation({ path: "/administration/compliance-register?tab=insurance" });
  render(
    <Router hook={loc.hook} searchHook={loc.searchHook}>
      <InsuranceRegisterContent embedded />
    </Router>,
  );
}

describe("Insurance register delete confirm", () => {
  beforeEach(() => {
    deleteSpy.mockReset();
    state.pending = false;
    state.fail = false;
  });
  afterEach(cleanup);

  it("opens the confirm dialog on Delete without deleting", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("insurance-delete-7"));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete this insurance policy?")).toBeInTheDocument();
    expect(within(dialog).getByText("This removes the policy for NRCS-VEH-0007. You can't undo this.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toHaveClass("bg-danger");
    expect(dialog.textContent).not.toMatch(/\u2014|\u2013/);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("Cancel closes the dialog and keeps the policy", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("insurance-delete-7"));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(screen.getByText("POL-7")).toBeInTheDocument();
  });

  it("confirming calls delete once for that policy and closes", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("insurance-delete-7"));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith({ id: 7 });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("shows the generic message on failure, never the raw error", async () => {
    state.fail = true;
    renderPage();
    await userEvent.click(screen.getByTestId("insurance-delete-7"));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await within(dialog).findByText(DELETE_RECORD_ERROR)).toBeInTheDocument();
    expect(dialog.textContent).not.toContain("foreign key");
  });

  it("disables the buttons while the delete is running", async () => {
    state.pending = true;
    renderPage();
    expect(screen.getByTestId("insurance-delete-7")).toBeDisabled();
  });

  it("names the asset code, then the property, never the em dash placeholder", () => {
    expect(insuranceDeleteLabel({ assetCode: "A-1", assetOrProperty: "Hilux", policyNumber: "P" })).toBe("A-1");
    expect(insuranceDeleteLabel({ assetCode: null, assetOrProperty: "Abuja NHQ", policyNumber: "P" })).toBe("Abuja NHQ");
    expect(insuranceDeleteLabel({ assetCode: null, assetOrProperty: "\u2014", policyNumber: "POL-9" })).toBe("POL-9");
  });

  it("the add policy dialog has no DD/MM/YYYY hint beside the dates", async () => {
    renderPage();
    await userEvent.click(screen.getAllByRole("button", { name: /Add policy/ })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Policy start")).toBeInTheDocument();
    expect(dialog.textContent).not.toContain("DD/MM/YYYY");
  });
});
