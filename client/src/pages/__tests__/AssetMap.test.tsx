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

  it("the facility link uses the map link token, never text-primary", async () => {
    await renderPage("?mapMock=1");
    fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
    const link = screen.getByTestId("asset-map-parent-facility-link");
    expect(link).toHaveTextContent("National Headquarters");
    expect(link.className).toContain("text-[#1E3A8A]");
    expect(link.className).toContain("dark:text-[#93C5FD]");
    expect(link.className).not.toMatch(/\btext-primary\b/);
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

/** Gives every element a fixed clientWidth so the page sees a real frame width (jsdom reports 0). */
function stubFrameWidth(width: number) {
  const proto = HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, "clientWidth");
  Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => width });
  return () => {
    if (original) Object.defineProperty(proto, "clientWidth", original);
  };
}

describe("Asset Map narrow desktop (drawer open, under 480px of free map)", () => {
  let restore: () => void = () => {};
  afterEach(() => restore());

  it("collapses the panel to the compact card, centres the layer bar, and restores everything on close", async () => {
    restore = stubFrameWidth(992);
    await renderPage("?mapMock=1");
    const panel = screen.getByTestId("asset-map-facility-panel");
    const scroller = panel.querySelector<HTMLElement>("[data-panel-scroll]")!;
    scroller.scrollTop = 140;
    expect(screen.queryByTestId("asset-map-compact-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("asset-map-layer-bar")).toHaveAttribute("data-placement", "besidePanel");

    fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
    expect(screen.getByTestId("asset-map-drawer")).toBeInTheDocument();
    const card = screen.getByTestId("asset-map-compact-panel");
    expect(card).toHaveTextContent("6 facilities · 4 on the map");
    expect(panel).toHaveAttribute("data-concealed", "true");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    const bar = screen.getByTestId("asset-map-layer-bar");
    expect(bar).toHaveAttribute("data-placement", "centred");
    expect(bar.style.left).toBe("256px");
    expect(bar.style.width).toBe("336px");

    // Selecting scrolls the hidden list to the row; closing must put the scroll back.
    scroller.scrollTop = 0;
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("asset-map-compact-panel")).not.toBeInTheDocument();
    expect(panel).not.toHaveAttribute("data-concealed");
    expect(scroller.scrollTop).toBe(140);
    expect(screen.getByTestId("asset-map-layer-bar")).toHaveAttribute("data-placement", "besidePanel");
  });

  it("the chevron expands the full panel while the drawer stays open, and collapses it again", async () => {
    restore = stubFrameWidth(992);
    await renderPage("?mapMock=1");
    fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
    fireEvent.click(screen.getByTestId("asset-map-panel-expand"));
    expect(screen.queryByTestId("asset-map-compact-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("asset-map-facility-panel")).not.toHaveAttribute("data-concealed");
    expect(screen.getByTestId("asset-map-drawer")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("asset-map-panel-collapse"));
    expect(screen.getByTestId("asset-map-compact-panel")).toBeInTheDocument();
    // The next drawer after a close starts collapsed again.
    fireEvent.click(screen.getByTestId("asset-map-panel-expand"));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByTestId("asset-map-row-BOR-001"));
    expect(screen.getByTestId("asset-map-compact-panel")).toBeInTheDocument();
  });

  it("the compact search filters the same list", async () => {
    restore = stubFrameWidth(992);
    await renderPage("?mapMock=1");
    fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
    fireEvent.change(screen.getByTestId("asset-map-compact-search"), { target: { value: "Borno" } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(screen.getByTestId("asset-map-compact-panel")).toHaveTextContent("1 facility · 1 on the map");
    expect(screen.getByTestId("asset-map-search")).toHaveValue("Borno");
  });

  it("wide frames keep the full panel with the drawer open", async () => {
    restore = stubFrameWidth(1632);
    await renderPage("?mapMock=1");
    fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
    expect(screen.queryByTestId("asset-map-compact-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("asset-map-facility-panel")).not.toHaveAttribute("data-concealed");
    expect(screen.getByTestId("asset-map-layer-bar")).toHaveAttribute("data-placement", "besidePanel");
  });

  it("pans (never zooms) so the pin and its label land between the compact card and the drawer", async () => {
    restore = stubFrameWidth(992);
    await renderPage("");
    fakeMap.panBy.mockClear();
    fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    // Map div is 1000 wide; Kano projects at x=900. Free area right edge: 1000 - (400 drawer + 100 label room) - 32.
    expect(fakeMap.panBy).toHaveBeenCalledWith(900 - (1000 - 500 - 32), 0);
    expect(fakeMap.setZoom).not.toHaveBeenCalled();
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
  });
});

describe("Asset Map phone empty card", () => {
  function setPhone() {
    window.matchMedia = ((q: string) => ({
      matches: q.includes("pointer: coarse"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
  }

  it("hides the map empty card while the list sheet is above peek and shows it at peek", async () => {
    setPhone();
    await renderPage("?mapMock=1&types=clinic&tiers=low");
    const sheet = screen.getByTestId("asset-map-list-sheet");
    const handle = within(sheet).getByRole("button", { name: /Facility list: (expand|collapse)/ });
    const tap = () => {
      fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientY: 500, pointerId: 1 });
    };
    expect(sheet).toHaveAttribute("data-snap", "half");
    expect(screen.queryByTestId("asset-map-empty")).not.toBeInTheDocument();
    tap();
    expect(sheet).toHaveAttribute("data-snap", "full");
    expect(screen.queryByTestId("asset-map-empty")).not.toBeInTheDocument();
    tap();
    expect(sheet).toHaveAttribute("data-snap", "peek");
    expect(screen.getByTestId("asset-map-empty")).toBeInTheDocument();
    // The card box sits right of the 16px inset and left of the control column (width 0 in jsdom) plus 12.
    const area = screen.getByTestId("asset-map-empty-area");
    expect(area.style.left).toBe("16px");
    expect(area.style.right).toBe(`${16 + 0 + 12}px`);
    expect(area.style.bottom).toBe("96px");
  });

  it("with 0 matches the readiness bar is the empty neutral track", async () => {
    setPhone();
    const { container } = await renderPage("?mapMock=1&types=clinic&tiers=low");
    expect(screen.getByTestId("asset-map-list-sheet")).toHaveTextContent("0 of 6 facilities match");
    const track = container.querySelector("[data-testid=asset-map-list-sheet] .h-2.overflow-hidden.rounded-full");
    expect(track).not.toBeNull();
    expect(track!.children).toHaveLength(0);
  });
});

