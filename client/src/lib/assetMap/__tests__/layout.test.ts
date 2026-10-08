import { describe, expect, it } from "vitest";
import {
  COMPACT_PANEL_W,
  collapsedLayerBarPlacement,
  desktopLeftInset,
  freeMapWidth,
  isNarrowMap,
  showMobileEmptyCard,
  withLabelRoom,
} from "../layout";

describe("Asset Map desktop layout", () => {
  it("collapses only when the panel and drawer leave under 480px of map", () => {
    // 1280 with the 256 sidebar: a 992px frame leaves 200px between panel and drawer.
    expect(freeMapWidth(992)).toBe(200);
    expect(isNarrowMap(992)).toBe(true);
    expect(isNarrowMap(1271)).toBe(true);
    expect(isNarrowMap(1272)).toBe(false);
    expect(isNarrowMap(1632)).toBe(false);
    // Unknown size (first render, jsdom) never collapses.
    expect(isNarrowMap(0)).toBe(false);
  });

  it("uses the compact card width for the left inset when collapsed", () => {
    expect(desktopLeftInset(false)).toBe(392);
    expect(desktopLeftInset(true)).toBe(16 + COMPACT_PANEL_W + 16);
  });

  it("centres the layer bar between the compact card and the drawer when it fits", () => {
    expect(collapsedLayerBarPlacement({ frameWidth: 992, layerBarWidth: 330, compactCardHeight: 92 })).toEqual({
      mode: "centred",
      left: 256,
      width: 336,
    });
  });

  it("stacks the layer bar under the card when the free area is narrower than the bar", () => {
    expect(collapsedLayerBarPlacement({ frameWidth: 900, layerBarWidth: 330, compactCardHeight: 92 })).toEqual({
      mode: "belowCard",
      left: 16,
      top: 16 + 92 + 8,
    });
  });

  it("adds room for the selected pin label, shrinking it when the free area is small", () => {
    const base = { top: 72, right: 400, bottom: 40, left: 256 };
    expect(withLabelRoom(base, 992)).toEqual({ top: 96, right: 500, bottom: 40, left: 356 });
    const tight = withLabelRoom(base, 800);
    expect(tight.left - base.left).toBe(tight.right - base.right);
    expect(800 - tight.left - tight.right).toBeGreaterThan(64);
  });
});

describe("Asset Map phone empty card", () => {
  it("shows only with the list sheet at peek and no detail sheet", () => {
    expect(showMobileEmptyCard("peek", false)).toBe(true);
    expect(showMobileEmptyCard("half", false)).toBe(false);
    expect(showMobileEmptyCard("full", false)).toBe(false);
    expect(showMobileEmptyCard("peek", true)).toBe(false);
  });
});
