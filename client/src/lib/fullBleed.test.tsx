import { act, cleanup, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FULL_BLEED_VIEWS, FullBleedProvider, useAutoRail, useFullBleed, useFullBleedRegistry } from "./fullBleed";
import { SIDEBAR_FULL_WIDTH, SIDEBAR_RAIL_WIDTH } from "./sidebarWidth";

afterEach(() => cleanup());

/** A tiny layout: saved preference + registry + auto rail, like DashboardLayout. */
let api: { toggle: (w: number) => void; setMobile: (v: boolean) => void } = { toggle: () => {}, setMobile: () => {} };

function Layout({ initialSaved, onSave, children }: { initialSaved: number; onSave: (w: number) => void; children: React.ReactNode }) {
  const [saved, setSaved] = useState(initialSaved);
  const [isMobile, setMobile] = useState(false);
  const { active, registry } = useFullBleedRegistry();
  const { width, autoRail, inVisit, onManualWidth } = useAutoRail({
    saved,
    fullBleed: active,
    isMobile,
    onSaveWidth: (w) => {
      onSave(w);
      setSaved(w);
    },
  });
  api = { toggle: onManualWidth, setMobile };
  return (
    <FullBleedProvider value={registry}>
      <output data-testid="state" data-width={width} data-auto={String(autoRail)} data-visit={String(inVisit)} data-saved={saved} />
      {children}
    </FullBleedProvider>
  );
}

function MapPage() {
  useFullBleed(true);
  return <div>map</div>;
}

function PlainPage() {
  return <div>plain</div>;
}

/** Facilities: full bleed only while the Map view is showing. */
function FacilitiesLike({ view }: { view: "table" | "card" | "map" }) {
  useFullBleed(view === "map");
  return <div>{view}</div>;
}

const state = () => {
  const el = screen.getByTestId("state");
  return {
    width: Number(el.dataset.width),
    auto: el.dataset.auto === "true",
    visit: el.dataset.visit === "true",
    saved: Number(el.dataset.saved),
  };
};

function App({ page, initialSaved = SIDEBAR_FULL_WIDTH, onSave = () => {} }: { page: React.ReactNode; initialSaved?: number; onSave?: (w: number) => void }) {
  return (
    <Layout initialSaved={initialSaved} onSave={onSave}>
      {page}
    </Layout>
  );
}

describe("full bleed auto rail (Wave B)", () => {
  it("only flags the Asset Map and the Facilities map view", () => {
    expect(FULL_BLEED_VIEWS.map((v) => v.id)).toEqual(["asset-map", "facilities-map"]);
  });

  it("collapses to the rail on entering a full bleed view without writing the saved preference", () => {
    const onSave = vi.fn();
    const { rerender } = render(<App page={<PlainPage />} onSave={onSave} />);
    expect(state()).toMatchObject({ width: SIDEBAR_FULL_WIDTH, auto: false, visit: false });
    rerender(<App page={<MapPage />} onSave={onSave} />);
    expect(state()).toMatchObject({ width: SIDEBAR_RAIL_WIDTH, auto: true, visit: true, saved: SIDEBAR_FULL_WIDTH });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("restores the prior saved state on leaving", () => {
    const onSave = vi.fn();
    const { rerender } = render(<App page={<MapPage />} onSave={onSave} />);
    expect(state().width).toBe(SIDEBAR_RAIL_WIDTH);
    rerender(<App page={<PlainPage />} onSave={onSave} />);
    expect(state()).toMatchObject({ width: SIDEBAR_FULL_WIDTH, auto: false, visit: false, saved: SIDEBAR_FULL_WIDTH });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps a saved rail preference as the rail after leaving", () => {
    const { rerender } = render(<App page={<MapPage />} initialSaved={SIDEBAR_RAIL_WIDTH} />);
    rerender(<App page={<PlainPage />} initialSaved={SIDEBAR_RAIL_WIDTH} />);
    expect(state()).toMatchObject({ width: SIDEBAR_RAIL_WIDTH, saved: SIDEBAR_RAIL_WIDTH });
  });

  it("respects a manual expand for the rest of the visit only", () => {
    const onSave = vi.fn();
    const { rerender } = render(<App page={<MapPage />} onSave={onSave} />);
    act(() => api.toggle(SIDEBAR_FULL_WIDTH));
    expect(state()).toMatchObject({ width: SIDEBAR_FULL_WIDTH, auto: false, visit: true });
    // Still expanded while the view stays open (re-renders do not re-collapse it).
    rerender(<App page={<MapPage />} onSave={onSave} />);
    expect(state().width).toBe(SIDEBAR_FULL_WIDTH);
    expect(onSave).not.toHaveBeenCalled();
    // Leave and come back: a new visit collapses again.
    rerender(<App page={<PlainPage />} onSave={onSave} />);
    expect(state().width).toBe(SIDEBAR_FULL_WIDTH);
    rerender(<App page={<MapPage />} onSave={onSave} />);
    expect(state()).toMatchObject({ width: SIDEBAR_RAIL_WIDTH, auto: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("a manual collapse during a visit does not save a rail preference", () => {
    const onSave = vi.fn();
    const { rerender } = render(<App page={<MapPage />} onSave={onSave} />);
    act(() => api.toggle(SIDEBAR_FULL_WIDTH));
    act(() => api.toggle(SIDEBAR_RAIL_WIDTH));
    rerender(<App page={<PlainPage />} onSave={onSave} />);
    expect(state()).toMatchObject({ width: SIDEBAR_FULL_WIDTH, saved: SIDEBAR_FULL_WIDTH });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("toggles outside a full bleed view save the preference as before", () => {
    const onSave = vi.fn();
    render(<App page={<PlainPage />} onSave={onSave} />);
    act(() => api.toggle(SIDEBAR_RAIL_WIDTH));
    expect(onSave).toHaveBeenCalledWith(SIDEBAR_RAIL_WIDTH);
    expect(state()).toMatchObject({ width: SIDEBAR_RAIL_WIDTH, saved: SIDEBAR_RAIL_WIDTH });
  });

  it("leaves phones unchanged", () => {
    render(<App page={<MapPage />} />);
    act(() => api.setMobile(true));
    expect(state()).toMatchObject({ width: SIDEBAR_FULL_WIDTH, auto: false, visit: false });
  });

  it("Facilities collapses only while its Map view is showing", () => {
    const onSave = vi.fn();
    const { rerender } = render(<App page={<FacilitiesLike view="table" />} onSave={onSave} />);
    expect(state()).toMatchObject({ width: SIDEBAR_FULL_WIDTH, auto: false });
    rerender(<App page={<FacilitiesLike view="map" />} onSave={onSave} />);
    expect(state()).toMatchObject({ width: SIDEBAR_RAIL_WIDTH, auto: true });
    rerender(<App page={<FacilitiesLike view="card" />} onSave={onSave} />);
    expect(state()).toMatchObject({ width: SIDEBAR_FULL_WIDTH, auto: false });
    rerender(<App page={<FacilitiesLike view="map" />} onSave={onSave} />);
    expect(state().width).toBe(SIDEBAR_RAIL_WIDTH);
    rerender(<App page={<FacilitiesLike view="table" />} onSave={onSave} />);
    expect(state().width).toBe(SIDEBAR_FULL_WIDTH);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("useFullBleed is a no op outside the app layout", () => {
    expect(() => render(<MapPage />)).not.toThrow();
  });
});
