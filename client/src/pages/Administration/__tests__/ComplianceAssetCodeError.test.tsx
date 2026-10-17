/**
 * IVA-180 item 2: editing a vehicle and typing an asset code that doesn't exist must show an inline
 * error and must not save. Before the fix the form kept the old assetId, so Save quietly saved against
 * the previously selected asset.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vehicleMutate = vi.fn();
const genMutate = vi.fn();
const lookup = vi.fn(async ({ assetCode }: { assetCode: string }) =>
  assetCode === "NRCS-HQ-VEH-0002" ? { id: 22 } : null,
);

const vehicleRow = {
  id: 1,
  assetId: 11,
  assetCode: "NRCS-HQ-VEH-0001",
  description: "Toyota Hilux",
  branch: "National HQ",
  plateNumber: "ABJ-123-XY",
  roadWorthinessExpiry: "2027-01-01",
  insuranceExpiry: "2027-01-01",
  licenceExpiry: "2027-01-01",
  lastInspectionDate: "2026-09-01",
  notes: "",
  status: "valid",
};

vi.mock("@/lib/trpc", () => {
  const make = (path: string[]): unknown =>
    new Proxy(() => undefined, {
      get(_t, key: string) {
        const p = path.join(".");
        if (key === "useQuery")
          return () => ({ data: p === "complianceTracking.vehicles.list" ? [vehicleRow] : [], isLoading: false });
        if (key === "useMutation")
          return () => ({
            mutate:
              p === "complianceTracking.vehicles.upsert"
                ? vehicleMutate
                : p === "complianceTracking.generators.upsert"
                  ? genMutate
                  : vi.fn(),
            isPending: false,
          });
        if (key === "useUtils") return () => make(["utils"]);
        if (key === "fetch" && p === "utils.complianceTracking.lookupAsset") return lookup;
        if (key === "invalidate") return vi.fn();
        if (key === "then") return undefined;
        return make([...path, key]);
      },
    });
  return { trpc: make([]) };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin", siteId: 1 } }) }));

import ComplianceRegister from "../ComplianceRegister";

function renderAt(path: string) {
  const loc = memoryLocation({ path, record: true });
  render(
    <Router hook={loc.hook} searchHook={loc.searchHook}>
      <ComplianceRegister />
    </Router>,
  );
}

function openVehicleEdit() {
  renderAt("/administration/compliance-register?tab=vehicles");
  fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
  return screen.getByTestId("vehicle-asset-code") as HTMLInputElement;
}

describe("Compliance register asset code (IVA-180)", () => {
  beforeEach(() => {
    vehicleMutate.mockClear();
    genMutate.mockClear();
    lookup.mockClear();
  });
  afterEach(cleanup);

  it("an unknown code in the vehicle Edit dialog shows an inline error and does not save", async () => {
    const input = openVehicleEdit();
    expect(input.value).toBe("NRCS-HQ-VEH-0001");
    fireEvent.change(input, { target: { value: "NOPE-0001" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("No asset has this code. Check the code and try again.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(vehicleMutate).not.toHaveBeenCalled();
  });

  it("shows the error on blur too, and clears it when the code is edited", async () => {
    const input = openVehicleEdit();
    fireEvent.change(input, { target: { value: "NOPE-0001" } });
    fireEvent.blur(input);
    await screen.findByRole("alert");
    fireEvent.change(input, { target: { value: "NRCS-HQ-VEH-000" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("an unchanged code saves against the existing asset without a lookup", async () => {
    openVehicleEdit();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(vehicleMutate).toHaveBeenCalledTimes(1));
    expect(vehicleMutate.mock.calls[0][0]).toMatchObject({ id: 1, assetId: 11 });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("a changed, valid code saves against the new asset", async () => {
    const input = openVehicleEdit();
    fireEvent.change(input, { target: { value: "NRCS-HQ-VEH-0002" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(vehicleMutate).toHaveBeenCalledTimes(1));
    expect(vehicleMutate.mock.calls[0][0]).toMatchObject({ id: 1, assetId: 22 });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Coco (#151): the native date input shows the format, so no DD/MM/YYYY hint beside the dates.
  it("the vehicle and generator dialogs show no DD/MM/YYYY hint beside the dates", () => {
    openVehicleEdit();
    const vehicle = screen.getByRole("dialog");
    expect(vehicle.textContent).toContain("Road worthiness expiry");
    expect(vehicle.textContent).not.toContain("DD/MM/YYYY");
    cleanup();
    renderAt("/administration/compliance-register?tab=generators");
    fireEvent.click(screen.getByRole("button", { name: /add generator record/i }));
    const generator = screen.getByRole("dialog");
    expect(generator.textContent).toContain("Next service due");
    expect(generator.textContent).not.toContain("DD/MM/YYYY");
  });
});
