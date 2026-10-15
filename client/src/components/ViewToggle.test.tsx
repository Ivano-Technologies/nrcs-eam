import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewMode, viewModeStorageKey } from "@/hooks/useViewMode";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => mobile.value }));
import { ViewToggle, type ViewMode, type ViewModeWithMap } from "./ViewToggle";

afterEach(() => cleanup());

function WithMap({ initial }: { initial: ViewModeWithMap }) {
  const [v, setV] = useState<ViewModeWithMap>(initial);
  return <ViewToggle value={v} onChange={setV} showMap />;
}

const pressed = () =>
  ["table", "card", "map"].filter((m) => screen.queryByTestId(`view-toggle-${m}`)?.getAttribute("aria-pressed") === "true");

describe("ViewToggle (Wave B, Facilities Map segment)", () => {
  it("selects Map while the Map view is showing", () => {
    render(<WithMap initial="map" />);
    expect(pressed()).toEqual(["map"]);
    expect(screen.getByTestId("view-toggle-map").className).toContain("bg-primary");
    expect(screen.getByTestId("view-toggle-table").className).not.toContain("bg-primary");
  });

  it("Table and Card stay correct, and switching moves the selection", () => {
    render(<WithMap initial="table" />);
    expect(pressed()).toEqual(["table"]);
    fireEvent.click(screen.getByTestId("view-toggle-card"));
    expect(pressed()).toEqual(["card"]);
    fireEvent.click(screen.getByTestId("view-toggle-map"));
    expect(pressed()).toEqual(["map"]);
    fireEvent.click(screen.getByTestId("view-toggle-table"));
    expect(pressed()).toEqual(["table"]);
  });

  it("other pages keep the two segment toggle", () => {
    function Two() {
      const [v, setV] = useState<ViewMode>("card");
      return <ViewToggle value={v} onChange={setV} />;
    }
    render(<Two />);
    expect(screen.queryByTestId("view-toggle-map")).toBeNull();
    expect(pressed()).toEqual(["card"]);
  });
});

describe("Saved Card or Table view (polish phase 1)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mobile.value = false;
  });

  it("opens in Card by default on desktop", () => {
    const { result } = renderHook(() => useViewMode("bin_cards"));
    expect(result.current[0]).toBe("card");
  });

  it("dense lists pass Table as their default", () => {
    const { result } = renderHook(() => useViewMode("assets", "table"));
    expect(result.current[0]).toBe("table");
  });

  it("phones always open in Card", () => {
    mobile.value = true;
    window.localStorage.setItem(viewModeStorageKey("assets"), "table");
    const { result } = renderHook(() => useViewMode("assets", "table"));
    expect(result.current[0]).toBe("card");
  });

  it("never writes on page load, only on a toggle", () => {
    const { result } = renderHook(() => useViewMode("stock_cards"));
    expect(window.localStorage.getItem(viewModeStorageKey("stock_cards"))).toBeNull();
    act(() => result.current[1]("table"));
    expect(result.current[0]).toBe("table");
    expect(window.localStorage.getItem("viewMode_v2_stock_cards")).toBe("table");
  });

  it("reopens in the toggled choice", () => {
    window.localStorage.setItem("viewMode_v2_fleet_health", "table");
    const { result } = renderHook(() => useViewMode("fleet_health"));
    expect(result.current[0]).toBe("table");
  });

  it("one time reset: ignores and removes the old auto written key", () => {
    window.localStorage.setItem("viewMode_requisitions_demo", "table");
    const { result } = renderHook(() => useViewMode("requisitions_demo"));
    expect(result.current[0]).toBe("card");
    expect(window.localStorage.getItem("viewMode_requisitions_demo")).toBeNull();
  });
});

