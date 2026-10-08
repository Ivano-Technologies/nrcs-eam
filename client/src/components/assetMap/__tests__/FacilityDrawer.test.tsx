import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FacilityDrawer } from "../FacilityDrawer";

afterEach(cleanup);

const facility = {
  id: 7,
  code: "KAN-001",
  name: "Kano State Branch",
  facilityType: "branch",
  lat: 12,
  lng: 8.5,
  parentFacilityId: 1,
  city: "Kano",
  state: "Kano",
  isActive: true,
  stockScorePercent: 82,
  adequateCards: 41,
  totalCards: 50,
  lastMovementDate: "2026-10-06T09:00:00.000Z",
  assetCount: 64,
  assetsByStatus: { inUse: 56, maintenance: 5, retired: 3 },
  inventoryCount: 212,
  statsVisible: true,
} as const;

const detail = {
  id: 7,
  address: null,
  contactPerson: "Aminu Bello",
  contactPhone: "0803 555 0142",
  parentFacility: { id: 1, name: "National Headquarters", code: "NHQ-001" },
  bookValue: 184_600_000,
  openWorkOrders: 3,
  overdueWorkOrders: 1,
  statsVisible: true,
};

function renderDrawer(f: Record<string, unknown>, d: Record<string, unknown> | undefined, variant: "drawer" | "sheet" = "drawer") {
  return render(
    <FacilityDrawer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      facility={f as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detail={d as any}
      detailLoading={false}
      scheme="light"
      onClose={vi.fn()}
      onSelectFacility={vi.fn()}
      variant={variant}
    />
  );
}

describe("FacilityDrawer", () => {
  it("shows readiness, glance figures and contact for a visible facility", () => {
    renderDrawer(facility, detail);
    expect(screen.getByRole("dialog", { name: "Kano State Branch" })).toBeInTheDocument();
    expect(screen.getByText("41 of 50 stock cards adequate")).toBeInTheDocument();
    expect(screen.getByText("Last stock movement 6 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("Book value")).toBeInTheDocument();
    expect(screen.getByText("Open work orders")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0803 555 0142" })).toHaveAttribute("href", "tel:08035550142");
    expect(screen.getByRole("link", { name: /View assets/ })).toHaveAttribute("href", "/app/assets?siteId=7");
    expect(screen.getByRole("button", { name: "Close facility details" })).toBeInTheDocument();
  });

  it("hides asset count, book value and work orders when the server withholds them", () => {
    renderDrawer(
      { ...facility, statsVisible: false, assetCount: null, assetsByStatus: null },
      { ...detail, statsVisible: false, bookValue: null, openWorkOrders: null, overdueWorkOrders: null }
    );
    expect(screen.queryByText("Book value")).not.toBeInTheDocument();
    expect(screen.queryByText("Open work orders")).not.toBeInTheDocument();
    expect(screen.queryByText("Assets")).not.toBeInTheDocument();
    expect(screen.getByTestId("asset-map-drawer-stats-hidden")).toHaveTextContent("your own facility only");
    expect(screen.getByText("Inventory items")).toBeInTheDocument();
  });

  it("offers Stock settings when there is no readiness score", () => {
    renderDrawer({ ...facility, stockScorePercent: null, totalCards: 0, adequateCards: 0 }, detail);
    expect(screen.getByText("No stock cards with a minimum level yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stock settings" })).toBeInTheDocument();
  });

  it("pads the phone sheet body past the bottom nav, but not the desktop drawer", () => {
    renderDrawer(facility, detail, "sheet");
    expect(screen.getByTestId("asset-map-drawer-body").style.paddingBottom).toContain("80px");
    expect(screen.getByTestId("asset-map-drawer-body").style.paddingBottom).toContain("safe-area-inset-bottom");
    cleanup();
    renderDrawer(facility, detail, "drawer");
    expect(screen.getByTestId("asset-map-drawer-body").style.paddingBottom).toBe("");
  });
});
