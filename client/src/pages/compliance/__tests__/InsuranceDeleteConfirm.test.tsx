/**
 * Insurance register delete confirm (Chief, #151; Coco's copy): Delete on a policy row opens the shared
 * register confirm dialog instead of deleting on one click. Cancel keeps the policy; confirming calls the delete once.
 * A failed delete shows the generic message, never the raw server error. The add policy dialog has no
 * DD/MM/YYYY hint; each date reads back in the table format under the native picker (Coco).
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    assetOrProperty: "Toyota Hilux 2.4 double cab",
    facilityName: "Abuja NHQ",
    insuranceType: "Vehicle",
    insurer: "Leadway",
    policyNumber: "AXA/MV/2026/00142",
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
import { InsuranceRegisterContent, insuranceDeleteDescription } from "../InsuranceRegister";

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
    expect(within(dialog).getByText("Delete this policy?")).toBeInTheDocument();
    expect(within(dialog).getByText("Policy AXA/MV/2026/00142 for Toyota Hilux 2.4 double cab will be removed. This cannot be undone.")).toBeInTheDocument();
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
    expect(screen.getByText("AXA/MV/2026/00142")).toBeInTheDocument();
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

  it("drops a missing policy number or asset description gracefully, never the em dash placeholder", () => {
    const end = "will be removed. This cannot be undone.";
    expect(insuranceDeleteDescription({ policyNumber: "P-1", assetOrProperty: "Hilux" })).toBe(`Policy P-1 for Hilux ${end}`);
    expect(insuranceDeleteDescription({ policyNumber: "", assetOrProperty: "Hilux" })).toBe(`This policy for Hilux ${end}`);
    expect(insuranceDeleteDescription({ policyNumber: "P-1", assetOrProperty: "\u2014" })).toBe(`Policy P-1 ${end}`);
    expect(insuranceDeleteDescription({ policyNumber: null, assetOrProperty: null })).toBe(`This policy ${end}`);
  });

  it("the add policy dialog reads back picked dates and has no DD/MM/YYYY hint", async () => {
    renderPage();
    await userEvent.click(screen.getAllByRole("button", { name: /Add policy/ })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Policy start")).toBeInTheDocument();
    expect(dialog.textContent).not.toContain("DD/MM/YYYY");
    expect(within(dialog).queryByTestId("date-readback")).toBeNull();
    const [start, end] = Array.from(dialog.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    fireEvent.change(start, { target: { value: "2026-09-04" } });
    fireEvent.change(end, { target: { value: "2027-01-14" } });
    expect(within(dialog).getAllByTestId("date-readback").map((n) => n.textContent)).toEqual(["4 Sep 2026", "14 Jan 2027"]);
  });
});
