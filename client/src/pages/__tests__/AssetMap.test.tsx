/**
 * Asset Map page regressions (spec 7.4): selection opens the drawer and never zooms, empty state,
 * no-location count, and layer switches keep filters, selection and the one map instance.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const base = {
  city: null,
  isActive: true,
  adequateCards: 0,
  totalCards: 0,
  lastMovementDate: null,
  inventoryCount: 3,
  statsVisible: true,
  parentFacilityId: 1,
};
const FACILITIES: Row[] = [
  { ...base, id: 1, code: "NHQ-001", name: "National Headquarters", facilityType: "national_headquarters", lat: 9.05, lng: 7.49, state: "FCT", parentFacilityId: null, stockScorePercent: 80, adequateCards: 8, totalCards: 10, assetCount: 10, assetsByStatus: { inUse: 8, maintenance: 1, retired: 1 } },
  { ...base, id: 2, code: "KAN-001", name: "Kano State Branch", facilityType: "branch", lat: 12, lng: 8.5, state: "Kano", stockScorePercent: 82, adequateCards: 41, totalCards: 50, assetCount: 64, assetsByStatus: { inUse: 56, maintenance: 5, retired: 3 } },
  { ...base, id: 3, code: "BOR-001", name: "Borno State Branch", facilityType: "branch", lat: 11.8, lng: 13.1, state: "Borno", stockScorePercent: 44, assetCount: 12, assetsByStatus: { inUse: 10, maintenance: 2, retired: 0 } },
  { ...base, id: 4, code: "CLN-001", name: `<img src=x onerror="alert(1)">Clinic`, facilityType: "clinic", lat: 6.5, lng: 3.4, state: "Lagos", stockScorePercent: 90, assetCount: 3, assetsByStatus: { inUse: 3, maintenance: 0, retired: 0 } },
  { ...base, id: 5, code: "WH-009", name: "Unmapped Warehouse", facilityType: "warehouse", lat: null, lng: null, state: "Oyo", stockScorePercent: null, assetCount: 4, assetsByStatus: { inUse: 4, maintenance: 0, retired: 0 } },
  { ...base, id: 6, code: "DIV-404", name: "Unmapped Division", facilityType: "division", lat: null, lng: null, state: "Ogun", stockScorePercent: null, isActive: false, assetCount: 0, assetsByStatus: { inUse: 0, maintenance: 0, retired: 0 } },
];
const RESULT = { generatedAt: "2026-10-08T09:12:00.000Z", statsScope: "all", ownFacilityId: null, facilities: FACILITIES };

vi.mock("@/lib/trpc", () => ({
  trpc: {
    sites: {
      mapFacilities: { useQuery: () => ({ data: RESULT, isLoading: false }) },
      mapFacilityDetail: {
        useQuery: (input: { id: number }, opts: { enabled: boolean }) =>
          opts.enabled
            ? { data: { id: input.id, address: null, contactPerson: "Aminu Bello", contactPhone: "0803 555 0142", parentFacility: { id: 1, name: "National Headquarters", code: "NHQ-001" }, bookValue: 1000, openWorkOrders: 2, overdueWorkOrders: 1, statsVisible: true }, isLoading: false }
            : { data: undefined, isLoading: false },
      },
    },
  },
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));

// Google path: a fake map handed to the page through a mocked MapView.
const mapMounts = { count: 0 };
const fakeMap = {
  getZoom: vi.fn(() => 6),
  setZoom: vi.fn(),
  fitBounds: vi.fn(),
  panBy: vi.fn(),
  panTo: vi.fn(),
  setMapTypeId: vi.fn(),
  getDiv: () => ({ clientWidth: 1000, clientHeight: 700 }),
  addListener: vi.fn(() => ({ remove() {} })),
};
vi.mock("@/components/Map", () => ({
  MapView: ({ onMapReady }: { onMapReady: (m: unknown) => void }) => {
    React.useEffect(() => {
      mapMounts.count += 1;
      onMapReady(fakeMap);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-testid="asset-map-container" />;
  },
}));

function setDesktop() {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("min-width"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

function stubGoogle() {
  class OverlayView {
    setMap() {}
    getProjection() {
      return { fromLatLngToContainerPixel: () => ({ x: 900, y: 300 }) };
    }
  }
  (window as unknown as { google: unknown }).google = {
    maps: {
      OverlayView,
      LatLng: class {
        constructor(public lat: number, public lng: number) {}
      },
      LatLngBounds: class {
        extend() {}
      },
    },
  };
}

async function renderPage(search: string) {
  window.history.replaceState(null, "", `/app/asset-map${search}`);
  const { default: AssetMap } = await import("../AssetMap");
  const utils = render(<AssetMap />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300)); // frame "stable" timer + rAF
  });
  return utils;
}

beforeEach(() => {
  setDesktop();
  stubGoogle();
  mapMounts.count = 0;
  Object.values(fakeMap).forEach((f) => typeof f === "function" && "mockClear" in f && (f as ReturnType<typeof vi.fn>).mockClear());
  localStorage.clear();
});
afterEach(() => {
  cleanup();
});

describe("Asset Map (mapMock)", () => {
  it("clicking a marker opens the drawer, adds ?facility= and keeps the zoom", async () => {
    await renderPage("?mapMock=1");
    const mock = screen.getByTestId("asset-map-mock");
    const zoomBefore = mock.getAttribute("data-zoom");
    fireEvent.click(screen.getByTestId("asset-map-marker-KAN-001"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const drawer = screen.getByTestId("asset-map-drawer");
    expect(within(drawer).getByRole("heading", { name: "Kano State Branch" })).toBeInTheDocument();
    expect(drawer).toHaveAttribute("role", "dialog");
    expect(window.location.search).toContain("facility=KAN-001");
    expect(screen.getByTestId("asset-map-mock").getAttribute("data-zoom")).toBe(zoomBefore);
  });

  it("clicking a list row opens the same drawer and keeps the zoom", async () => {
    await renderPage("?mapMock=1");
    const zoomBefore = screen.getByTestId("asset-map-mock").getAttribute("data-zoom");
    fireEvent.click(screen.getByTestId("asset-map-row-BOR-001"));
    expect(within(screen.getByTestId("asset-map-drawer")).getByRole("heading", { name: "Borno State Branch" })).toBeInTheDocument();
    expect(screen.getByTestId("asset-map-mock").getAttribute("data-zoom")).toBe(zoomBefore);
  });

  it("a filter with no results shows the empty card, and Clear filters brings pins back", async () => {
    await renderPage("?mapMock=1&types=clinic&tiers=low");
    const empty = screen.getByTestId("asset-map-empty");
    expect(empty).toHaveAttribute("role", "status");
    expect(screen.queryAllByTestId(/^asset-map-marker-/)).toHaveLength(0);
    const zoomBefore = screen.getByTestId("asset-map-mock").getAttribute("data-zoom");
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByTestId("asset-map-empty")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^asset-map-marker-/)).toHaveLength(4);
    expect(screen.getByTestId("asset-map-mock").getAttribute("data-zoom")).toBe(zoomBefore);
  });

  it("the no-location chip counts facilities with null coordinates, and Show lists them", async () => {
    await renderPage("?mapMock=1");
    const chip = screen.getByTestId("asset-map-no-location");
    expect(chip).toHaveTextContent("2 facilities have no location");
    fireEvent.click(within(chip).getByRole("button", { name: "Show" }));
    const list = screen.getByTestId("asset-map-list");
    expect(within(list).getAllByRole("option")).toHaveLength(2);
    expect(within(list).getByText("Unmapped Warehouse")).toBeInTheDocument();
  });

  it("switching layers keeps filters, selection and the same map element", async () => {
    await renderPage("?mapMock=1&tiers=good");
    const mapEl = screen.getByTestId("asset-map-mock");
    fireEvent.click(screen.getByTestId("asset-map-marker-KAN-001"));
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByTestId("asset-map-assets-tab"));
      fireEvent.click(screen.getByTestId("asset-map-network-tab"));
    }
    fireEvent.click(screen.getByTestId("asset-map-assets-tab"));
    expect(screen.getByTestId("asset-map-assets-tab")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("asset-map-mock")).toBe(mapEl);
    expect(within(screen.getByTestId("asset-map-drawer")).getByRole("heading", { name: "Kano State Branch" })).toBeInTheDocument();
    const good = within(screen.getByTestId("asset-map-stock-filter")).getByRole("button", { name: /Good/ });
    expect(good).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("tiers=good");
    expect(window.location.search).toContain("layer=assets");
  });

  it("renders facility names as text in the list and drawer (no HTML injection)", async () => {
    const { container } = await renderPage("?mapMock=1");
    fireEvent.click(screen.getByTestId("asset-map-row-CLN-001"));
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(within(screen.getByTestId("asset-map-drawer")).getByRole("heading", { level: 2 }).textContent).toBe(`<img src=x onerror="alert(1)">Clinic`);
    expect(screen.getByRole("dialog", { name: `<img src=x onerror="alert(1)">Clinic` })).toBeInTheDocument();
  });

  it("Escape closes the drawer", async () => {
    await renderPage("?mapMock=1");
    fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
    expect(screen.getByTestId("asset-map-drawer")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("asset-map-drawer")).not.toBeInTheDocument();
    expect(window.location.search).not.toContain("facility=");
  });
});

describe("Asset Map (Google map path)", () => {
  it("fits once on first load; selection, filters and layer switches never zoom or refit", async () => {
    await renderPage("");
    expect(mapMounts.count).toBe(1);
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByTestId("asset-map-drawer")).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("asset-map-stock-filter")).getByRole("button", { name: /Low/ }));
    fireEvent.click(screen.getByTestId("asset-map-assets-tab"));
    fireEvent.click(screen.getByTestId("asset-map-lines-toggle"));
    fireEvent.click(screen.getByTestId("asset-map-network-tab"));

    expect(fakeMap.setZoom).not.toHaveBeenCalled();
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    // Kano projects at x=900, under the drawer, so selection panned (only).
    expect(fakeMap.panBy).toHaveBeenCalled();
    expect(mapMounts.count).toBe(1);
  });

  it("the Fit all facilities button is the control that refits", async () => {
    await renderPage("");
    fireEvent.click(screen.getByRole("button", { name: "Fit all facilities" }));
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(2);
    expect(fakeMap.setZoom).not.toHaveBeenCalled();
  });
});
