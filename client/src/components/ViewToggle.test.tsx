import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
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
