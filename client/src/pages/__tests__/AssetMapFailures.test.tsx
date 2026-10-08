/**
 * Asset Map failure paths (PR #102 smoke regressions):
 * - Google rejects the key (gm_authFailure) before the map is ready, or after markers exist, or a
 *   Google call starts throwing later. The page must detach every marker and line, stop touching
 *   Google, show the fallback card, and keep search, filters, the list, the drawer and the Assets
 *   tab working with no error boundary.
 * - The facility data request fails: an error with Retry, not "0 facilities".
 *
 * Uses the real MapView and AssetMapOverlay against a stub `google.maps` that can be switched to
 * "dead", where setters throw like Google's main.js does after an auth failure.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";

type Row = Record<string, unknown>;
const base = {
  city: null,
  isActive: true,
  adequateCards: 5,
  totalCards: 10,
  lastMovementDate: null,
  inventoryCount: 3,
  statsVisible: true,
  parentFacilityId: 1,
};
const FACILITIES: Row[] = [
  { ...base, id: 1, code: "NHQ-001", name: "National Headquarters", facilityType: "national_headquarters", lat: 9.05, lng: 7.49, state: "FCT", parentFacilityId: null, stockScorePercent: 80, assetCount: 10, assetsByStatus: { inUse: 8, maintenance: 1, retired: 1 } },
  { ...base, id: 2, code: "KAN-001", name: "Kano State Branch", facilityType: "branch", lat: 12, lng: 8.5, state: "Kano", stockScorePercent: 82, assetCount: 64, assetsByStatus: { inUse: 56, maintenance: 5, retired: 3 } },
  { ...base, id: 3, code: "BOR-001", name: "Borno State Branch", facilityType: "branch", lat: 11.8, lng: 13.1, state: "Borno", stockScorePercent: 44, assetCount: 12, assetsByStatus: { inUse: 10, maintenance: 2, retired: 0 } },
  { ...base, id: 4, code: "KAN-W02", name: "Kano Relief Warehouse", facilityType: "warehouse", lat: 12.05, lng: 8.53, state: "Kano", parentFacilityId: 2, stockScorePercent: 76, assetCount: 40, assetsByStatus: { inUse: 30, maintenance: 6, retired: 4 } },
  { ...base, id: 5, code: "WH-009", name: "Unmapped Warehouse", facilityType: "warehouse", lat: null, lng: null, state: "Oyo", stockScorePercent: null, assetCount: 4, assetsByStatus: { inUse: 4, maintenance: 0, retired: 0 } },
];
const RESULT = { generatedAt: "2026-10-08T09:12:00.000Z", statsScope: "all", ownFacilityId: null, facilities: FACILITIES };

// Mutable query state so a test can fail the facility request and then let Retry succeed.
const query = {
  data: RESULT as typeof RESULT | undefined,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(async () => ({})),
};
vi.mock("@/lib/trpc", () => ({
  trpc: {
    sites: {
      mapFacilities: { useQuery: () => query },
      mapFacilityDetail: {
        useQuery: (input: { id: number }, opts: { enabled: boolean }) =>
          opts.enabled
            ? { data: { id: input.id, address: null, contactPerson: "Aminu Bello", contactPhone: "0803 555 0142", parentFacility: null, bookValue: 1000, openWorkOrders: 2, overdueWorkOrders: 1, statsVisible: true }, isLoading: false }
            : { data: undefined, isLoading: false },
      },
    },
  },
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));

/* ---------------- stub google.maps ---------------- */
const g = {
  dead: false,
  calls: [] as string[],
  markers: [] as FakeMarker[],
  lines: [] as FakeLine[],
  maps: 0,
};
/** Like Google after gm_authFailure: setters on the dead API throw (the crash in the smoke run). */
function touch(name: string) {
  if (g.dead) throw new TypeError("Cannot read properties of undefined (reading 'get')");
  g.calls.push(name);
}
class FakeMarker {
  private m: unknown = null;
  private p: unknown = null;
  content: unknown = null;
  gmpClickable = false;
  title = "";
  zIndex = 0;
  collisionBehavior: unknown = null;
  constructor(opts: { position?: unknown } = {}) {
    touch("marker.new");
    this.p = opts.position ?? null;
    g.markers.push(this);
  }
  addEventListener() {}
  get map() {
    return this.m;
  }
  set map(v: unknown) {
    if (v !== null) touch("marker.map");
    this.m = v;
  }
  get position() {
    return this.p;
  }
  set position(v: unknown) {
    touch("marker.position");
    this.p = v;
  }
}
class FakeLine {
  private m: unknown = null;
  constructor() {
    touch("line.new");
    g.lines.push(this);
  }
  setMap(v: unknown) {
    if (v !== null) touch("line.setMap");
    this.m = v;
  }
  getMap() {
    return this.m;
  }
  setOptions() {
    touch("line.setOptions");
  }
}
class FakeMap {
  constructor() {
    touch("map.new");
    g.maps += 1;
  }
  addListener() {
    return { remove() {} };
  }
  getZoom() {
    touch("map.getZoom");
    return 6;
  }
  setZoom() {
    touch("map.setZoom");
  }
  fitBounds() {
    touch("map.fitBounds");
  }
  panBy() {
    touch("map.panBy");
  }
  panTo() {
    touch("map.panTo");
  }
  setMapTypeId() {
    touch("map.setMapTypeId");
  }
  getMapTypeId() {
    return "roadmap";
  }
  getCenter() {
    return { toJSON: () => ({ lat: 9, lng: 8 }) };
  }
  setCenter() {}
  getDiv() {
    return { clientWidth: 1000, clientHeight: 700 };
  }
}
class FakeOverlayView {
  setMap() {}
  getProjection() {
    touch("projection");
    return { fromLatLngToContainerPixel: () => ({ x: 900, y: 300 }) };
  }
}
let releaseLibraries: () => void = () => {};
let librariesGate: Promise<void> = Promise.resolve();

function installGoogle({ holdLibraries = false } = {}) {
  g.dead = false;
  g.calls = [];
  g.markers = [];
  g.lines = [];
  g.maps = 0;
  librariesGate = holdLibraries
    ? new Promise<void>((resolve) => {
        releaseLibraries = resolve;
      })
    : Promise.resolve();
  (window as unknown as { google: unknown }).google = {
    maps: {
      Map: FakeMap,
      OverlayView: FakeOverlayView,
      Polyline: FakeLine,
      LatLng: class {
        constructor(public lat: number, public lng: number) {}
      },
      LatLngBounds: class {
        extend() {}
      },
      CollisionBehavior: { REQUIRED: "REQUIRED", OPTIONAL_AND_HIDES_LOWER_PRIORITY: "OPTIONAL_AND_HIDES_LOWER_PRIORITY" },
      marker: { AdvancedMarkerElement: FakeMarker },
      importLibrary: () => librariesGate,
    },
  };
}

function setViewport(kind: "desktop" | "mobile") {
  window.matchMedia = ((q: string) => ({
    matches: kind === "desktop" ? q.includes("min-width") : q.includes("pointer: coarse"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

async function renderPage(search = "") {
  window.history.replaceState(null, "", `/app/asset-map${search}`);
  const { default: AssetMap } = await import("../AssetMap");
  const utils = render(
    <ErrorBoundary>
      <AssetMap />
    </ErrorBoundary>
  );
  await wait(300);
  return utils;
}

/** Google rejects the key: Google calls window.gm_authFailure (MapView hooks it). */
async function rejectKey() {
  g.dead = true;
  await act(async () => {
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure?.();
  });
  await wait(50);
}

function expectNoCrash() {
  expect(screen.queryByText(/An unexpected error occurred/)).not.toBeInTheDocument();
  expect(screen.getByTestId("asset-map-panel")).toBeInTheDocument();
}

/** Search, filters, row click, drawer, Assets tab: all must work with no map. */
async function exerciseWithoutMap(kind: "desktop" | "mobile") {
  const callsBefore = g.calls.length;
  const search = screen.getAllByTestId("asset-map-search")[0];
  fireEvent.change(search, { target: { value: "K" } });
  await wait(260);
  expectNoCrash();
  fireEvent.change(search, { target: { value: "Kano" } });
  await wait(260);
  expect(screen.getByTestId("asset-map-row-KAN-001")).toBeInTheDocument();
  expect(screen.queryByTestId("asset-map-row-BOR-001")).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: "" } });
  await wait(260);
  expectNoCrash();

  if (kind === "mobile") {
    const filtersButton = screen.queryByRole("button", { name: /^Filters/ });
    if (filtersButton) fireEvent.click(filtersButton);
  }
  const low = within(screen.getByTestId("asset-map-stock-filter")).getByRole("button", { name: /Low/ });
  fireEvent.click(low);
  await wait(20);
  expect(screen.getByTestId("asset-map-row-BOR-001")).toBeInTheDocument();
  expect(screen.queryByTestId("asset-map-row-KAN-001")).not.toBeInTheDocument();
  fireEvent.click(low);
  const warehouses = screen.queryByTestId("asset-map-facility-type");
  if (warehouses) {
    fireEvent.click(within(warehouses).getByRole("button", { name: /Warehouses/ }));
    await wait(20);
    expect(screen.queryByTestId("asset-map-row-KAN-001")).not.toBeInTheDocument();
    fireEvent.click(within(warehouses).getByRole("button", { name: /Warehouses/ }));
  }
  expectNoCrash();

  fireEvent.click(screen.getByTestId("asset-map-row-KAN-001"));
  await wait(50);
  expectNoCrash();
  const drawer = screen.getByTestId("asset-map-drawer");
  expect(within(drawer).getByRole("heading", { name: "Kano State Branch" })).toBeInTheDocument();
  expect(window.location.search).toContain("facility=KAN-001");

  fireEvent.click(screen.getByTestId("asset-map-assets-tab"));
  await wait(20);
  expectNoCrash();
  expect(screen.getByTestId("asset-map-assets-tab")).toHaveAttribute("aria-selected", "true");
  const linesToggle = screen.queryByTestId("asset-map-lines-toggle");
  fireEvent.click(screen.getByTestId("asset-map-network-tab"));
  if (linesToggle) fireEvent.click(screen.getByTestId("asset-map-lines-toggle"));
  await wait(20);
  fireEvent.click(screen.getByRole("button", { name: "Close facility details" }));
  await wait(20);
  expectNoCrash();
  expect(screen.queryByTestId("asset-map-drawer")).not.toBeInTheDocument();
  // Nothing touched Google after the failure (no marker updates, pans, zooms or fits).
  expect(g.calls.slice(callsBefore)).toEqual([]);
}

beforeEach(() => {
  query.data = RESULT;
  query.isLoading = false;
  query.isError = false;
  query.isFetching = false;
  query.refetch.mockClear();
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as { google?: unknown }).google;
});

describe.each(["desktop", "mobile"] as const)("Google Maps rejects the key (%s)", (kind) => {
  beforeEach(() => setViewport(kind));

  it("before the map is ready: fallback card, no map, everything else works", async () => {
    installGoogle({ holdLibraries: true });
    await renderPage();
    await rejectKey();
    await act(async () => releaseLibraries());
    await wait(50);
    expectNoCrash();
    expect(screen.getByTestId("asset-map-facility-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("asset-map-error")).toHaveTextContent("Google Maps rejected this host");
    expect(g.maps).toBe(0);
    expect(g.markers).toHaveLength(0);
    await exerciseWithoutMap(kind);
  });

  it("after markers and lines exist: detaches them all and never touches Google again", async () => {
    installGoogle();
    await renderPage("?lines=1");
    expect(g.maps).toBe(1);
    expect(g.markers.filter((m) => m.map !== null).length).toBeGreaterThan(0);
    expect(g.lines.filter((l) => l.getMap() !== null).length).toBeGreaterThan(0);
    // Open a facility first so a selected label exists too.
    fireEvent.click(screen.getByTestId("asset-map-row-BOR-001"));
    await wait(50);

    await rejectKey();
    expectNoCrash();
    expect(screen.getByTestId("asset-map-facility-fallback")).toBeInTheDocument();
    expect(g.markers.every((m) => m.map === null)).toBe(true);
    expect(g.lines.every((l) => l.getMap() === null)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close facility details" }));
    await exerciseWithoutMap(kind);
  });
});

describe("Google Maps fails later without an auth callback", () => {
  beforeEach(() => setViewport("desktop"));

  it("a Google call that throws switches to the fallback instead of crashing", async () => {
    installGoogle();
    await renderPage();
    expect(g.markers.length).toBeGreaterThan(0);
    g.dead = true; // e.g. quota or billing failure surfacing as a thrown error from main.js
    fireEvent.change(screen.getByTestId("asset-map-search"), { target: { value: "Kano" } });
    await wait(260);
    expectNoCrash();
    expect(screen.getByTestId("asset-map-error")).toHaveTextContent("Google Maps stopped responding");
    expect(screen.getByTestId("asset-map-row-KAN-001")).toBeInTheDocument();
    await exerciseWithoutMap("desktop");
  });
});

describe("facility data fails to load", () => {
  beforeEach(() => {
    setViewport("desktop");
    installGoogle();
  });

  it("shows an error with Retry (not 0 facilities), and Retry refetches", async () => {
    query.data = undefined;
    query.isError = true;
    const { rerender } = await renderPage();
    const error = screen.getByTestId("asset-map-data-error");
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveTextContent("Facility data didn't load");
    expect(error.textContent).not.toMatch(/[\u2013\u2014]/);
    expect(screen.queryByText(/facilities ·/)).not.toBeInTheDocument();
    expect(screen.queryByText("No facilities match")).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole("button", { name: "Retry" }));
    expect(query.refetch).toHaveBeenCalledTimes(1);

    query.isFetching = true;
    const { default: AssetMap } = await import("../AssetMap");
    rerender(
      <ErrorBoundary>
        <AssetMap />
      </ErrorBoundary>
    );
    expect(within(screen.getByTestId("asset-map-data-error")).getByRole("button", { name: "Retrying" })).toBeDisabled();

    query.data = RESULT;
    query.isError = false;
    query.isFetching = false;
    rerender(
      <ErrorBoundary>
        <AssetMap />
      </ErrorBoundary>
    );
    await wait(20);
    expect(screen.queryByTestId("asset-map-data-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("asset-map-row-KAN-001")).toBeInTheDocument();
    expectNoCrash();
  });

  it("the empty state stays different from the error state", async () => {
    await renderPage("?q=zzzz");
    expect(screen.getByText("No facilities match")).toBeInTheDocument();
    expect(screen.queryByTestId("asset-map-data-error")).not.toBeInTheDocument();
  });
});
