/**
 * Facilities Map view: status pins, the no location chip and its list, and the shared drawer.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const base = { city: null, adequateCards: 0, totalCards: 0, lastMovementDate: null, inventoryCount: 3, statsVisible: true, parentFacilityId: 1, stockScorePercent: 80, assetCount: 1, assetsByStatus: { inUse: 1, maintenance: 0, retired: 0 } };
const FACILITIES: Row[] = [
  { ...base, id: 1, code: "NHQ-001", name: "National Headquarters", facilityType: "national_headquarters", lat: 9.05, lng: 7.49, state: "FCT", isActive: true, parentFacilityId: null },
  { ...base, id: 2, code: "KAN-001", name: "Kano State Branch", facilityType: "branch", lat: 12, lng: 8.5, state: "Kano", isActive: true },
  { ...base, id: 3, code: "BOR-001", name: "Borno State Branch", facilityType: "branch", lat: 11.8, lng: 13.1, state: "Borno", isActive: false },
  { ...base, id: 4, code: "WH-009", name: "Unmapped Warehouse", facilityType: "warehouse", lat: null, lng: null, state: "Oyo", isActive: true },
];
const RESULT = { generatedAt: "2026-10-08T09:12:00.000Z", statsScope: "all", ownFacilityId: null, facilities: FACILITIES };

vi.mock("@/lib/trpc", () => ({
  trpc: {
    sites: {
      mapFacilities: { useQuery: () => ({ data: RESULT, isLoading: false, isError: false }) },
      mapFacilityDetail: {
        useQuery: (input: { id: number }, opts: { enabled: boolean }) =>
          opts.enabled
            ? { data: { id: input.id, address: null, contactPerson: null, contactPhone: null, parentFacility: null, bookValue: 0, openWorkOrders: 0, overdueWorkOrders: 0, statsVisible: true }, isLoading: false }
            : { data: undefined, isLoading: false },
      },
    },
  },
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/components/Map", () => ({ MapView: () => <div />, mapLoadErrorMessage: () => "Map failed" }));

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes("min-width"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, "", "/app/facilities/all?mapMock=1");
});
afterEach(() => cleanup());

async function renderMap(visible: number[], noLocation: { id: number; name: string; code?: string }[]) {
  const { FacilitiesMap } = await import("../FacilitiesMap");
  const utils = render(<FacilitiesMap visibleIds={new Set(visible)} noLocation={noLocation} />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  return utils;
}

describe("Facilities Map view", () => {
  it("draws pins only for facilities that pass the toolbar filters, labelled by status", async () => {
    await renderMap([1, 3], []);
    expect(screen.getByTestId("asset-map-marker-NHQ-001")).toHaveAttribute("aria-label", "National Headquarters, National HQ, active");
    expect(screen.getByTestId("asset-map-marker-BOR-001")).toHaveAttribute("aria-label", "Borno State Branch, Branch, inactive");
    expect(screen.queryByTestId("asset-map-marker-KAN-001")).not.toBeInTheDocument();
    const legend = screen.getByTestId("facilities-map-legend");
    expect(legend).toHaveTextContent("Active 1");
    expect(legend).toHaveTextContent("Inactive 1");
  });

  it("shows the no location count and lists those facilities on Show", async () => {
    await renderMap([1, 2, 3, 4], [{ id: 4, name: "Unmapped Warehouse", code: "WH-009" }]);
    const chip = screen.getByTestId("asset-map-no-location");
    expect(chip).toHaveTextContent("1 facility has no location");
    expect(screen.queryByTestId("facilities-map-no-location-list")).not.toBeInTheDocument();
    fireEvent.click(within(chip).getByRole("button", { name: "Show" }));
    const list = screen.getByTestId("facilities-map-no-location-list");
    expect(within(list).getByRole("link", { name: /Unmapped Warehouse/ })).toHaveAttribute("href", "/app/facilities/4");
    expect(within(chip).getByRole("button", { name: "Hide" })).toHaveAttribute("aria-pressed", "true");
  });

  it("hides the chip when every facility has a location", async () => {
    await renderMap([1, 2, 3], []);
    expect(screen.queryByTestId("asset-map-no-location")).not.toBeInTheDocument();
  });

  it("a pin opens the shared facility drawer with the bottom fade, and Esc closes it", async () => {
    await renderMap([1, 2, 3], []);
    fireEvent.click(screen.getByTestId("asset-map-marker-KAN-001"));
    const drawer = screen.getByTestId("asset-map-drawer");
    expect(within(drawer).getByRole("heading", { name: "Kano State Branch" })).toBeInTheDocument();
    expect(within(drawer).getByTestId("facility-drawer-fade")).toHaveClass("h-7");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("asset-map-drawer")).not.toBeInTheDocument();
  });
});
