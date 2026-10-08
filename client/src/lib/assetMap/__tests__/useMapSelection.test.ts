import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { panIntoFreeArea, useMapSelection } from "../useMapSelection";

function fakeMap() {
  return { panBy: vi.fn(), fitBounds: vi.fn(), setZoom: vi.fn(), panTo: vi.fn(), getZoom: vi.fn(() => 6) };
}

describe("useMapSelection", () => {
  it("select(id) opens the facility and only asks to bring it into view", () => {
    const map = fakeMap();
    const ensureVisible = vi.fn(() => {
      panIntoFreeArea(map, { x: 950, y: 300 }, { width: 1000, height: 700 }, { top: 16, right: 400, bottom: 40, left: 392 });
    });
    const { result } = renderHook(() => useMapSelection({ ensureVisible }));
    act(() => result.current.select(42));
    expect(result.current.selectedId).toBe(42);
    expect(ensureVisible).toHaveBeenCalledWith(42);
    // The regression: selection must never zoom or refit.
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.panBy).toHaveBeenCalledTimes(1);
    expect(map.getZoom()).toBe(6);
  });

  it("swaps selection in place and clear() restores focus to the opener", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    const { result } = renderHook(() => useMapSelection());
    act(() => result.current.select(1, opener));
    act(() => result.current.select(2));
    expect(result.current.selectedId).toBe(2);
    act(() => result.current.clear());
    expect(result.current.selectedId).toBeNull();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe("panIntoFreeArea", () => {
  const size = { width: 1000, height: 700 };
  const insets = { top: 16, right: 400, bottom: 40, left: 392 };

  it("does nothing when the point is already in the free area", () => {
    const map = fakeMap();
    expect(panIntoFreeArea(map, { x: 500, y: 300 }, size, insets)).toBeNull();
    expect(map.panBy).not.toHaveBeenCalled();
  });

  it("pans just enough to clear the drawer", () => {
    const map = fakeMap();
    // Free area right edge = 1000 - 400 - 32 = 568.
    expect(panIntoFreeArea(map, { x: 700, y: 300 }, size, insets)).toEqual({ x: 132, y: 0 });
    expect(map.panBy).toHaveBeenCalledWith(132, 0);
  });

  it("pans to clear the panel on the left", () => {
    const map = fakeMap();
    // Free area left edge = 392 + 32 = 424.
    expect(panIntoFreeArea(map, { x: 100, y: 300 }, size, insets)).toEqual({ x: -324, y: 0 });
  });
});
