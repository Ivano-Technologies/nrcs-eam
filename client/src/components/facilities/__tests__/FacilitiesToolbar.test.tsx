import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FacilitiesToolbar, type FacilitiesToolbarProps } from "../FacilitiesToolbar";

beforeAll(() => {
  // Radix Select and DropdownMenu need these in jsdom.
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.releasePointerCapture ??= () => {};
  proto.setPointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});
afterEach(() => cleanup());

function setup(over: Partial<FacilitiesToolbarProps> = {}) {
  const props: FacilitiesToolbarProps = {
    search: "",
    onSearch: vi.fn(),
    type: "all",
    onType: vi.fn(),
    state: "all",
    states: ["FCT", "Kano", "Lagos"],
    onState: vi.fn(),
    status: "all",
    onStatus: vi.fn(),
    counts: { total: 12, onMap: 10 },
    view: "table",
    onView: vi.fn(),
    onExport: vi.fn(),
    onTemplate: vi.fn(),
    onImport: vi.fn(),
    ...over,
  };
  render(<FacilitiesToolbar {...props} />);
  return props;
}

function openSelect(testId: string) {
  const trigger = screen.getByTestId(testId);
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  return screen.getByRole("listbox");
}

function openMenu() {
  const trigger = screen.getByTestId("facilities-more");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  return screen.getByRole("menu");
}

describe("Facilities toolbar", () => {
  it("shows search, the three selects, the count and the view toggle", () => {
    setup();
    expect(screen.getByPlaceholderText("Search name, code or address")).toBeInTheDocument();
    expect(screen.getByTestId("facilities-type-select")).toHaveTextContent("All types");
    expect(screen.getByTestId("facilities-state-select")).toHaveTextContent("All states");
    expect(screen.getByTestId("facilities-status-select")).toHaveTextContent("All statuses");
    expect(screen.getByTestId("facilities-count")).toHaveTextContent("12 facilities · 10 on the map");
    expect(screen.getByTestId("view-toggle-table")).toHaveAttribute("aria-pressed", "true");
  });

  it("typing in search reports the query", () => {
    const p = setup();
    fireEvent.change(screen.getByTestId("facilities-search"), { target: { value: "kano" } });
    expect(p.onSearch).toHaveBeenCalledWith("kano");
  });

  it("type, state and status selects report the picked value", () => {
    const p = setup();
    fireEvent.click(within(openSelect("facilities-type-select")).getByRole("option", { name: "Warehouses" }));
    expect(p.onType).toHaveBeenCalledWith("warehouse");
    fireEvent.click(within(openSelect("facilities-state-select")).getByRole("option", { name: "Kano" }));
    expect(p.onState).toHaveBeenCalledWith("Kano");
    fireEvent.click(within(openSelect("facilities-status-select")).getByRole("option", { name: "Inactive" }));
    expect(p.onStatus).toHaveBeenCalledWith("inactive");
  });

  it("the More actions menu has a label and runs Export, Template and Import", async () => {
    const p = setup();
    expect(screen.getByTestId("facilities-more")).toHaveAttribute("aria-label", "More actions: Export to Excel, Template, Import");
    for (const [name, fn] of [
      ["Export to Excel", p.onExport],
      ["Template", p.onTemplate],
      ["Import", p.onImport],
    ] as const) {
      const menu = openMenu();
      await act(async () => {
        fireEvent.click(within(menu).getByRole("menuitem", { name }));
      });
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps the view toggle selection in step with the view", () => {
    const p = setup({ view: "map" });
    expect(screen.getByTestId("view-toggle-map")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("view-toggle-card"));
    expect(p.onView).toHaveBeenCalledWith("card");
  });

  it("phones: a Filters button opens the selects in a sheet", () => {
    setup({ compact: true, state: "Kano" });
    expect(screen.queryByTestId("facilities-type-select")).not.toBeInTheDocument();
    const button = screen.getByTestId("facilities-filters-button");
    expect(button).toHaveAttribute("aria-label", "Filters, 1 on");
    fireEvent.click(button);
    const sheet = screen.getByTestId("facilities-filters-sheet");
    expect(within(sheet).getByTestId("facilities-type-select")).toBeInTheDocument();
    expect(within(sheet).getByTestId("facilities-state-select")).toHaveTextContent("Kano");
    expect(within(sheet).getByTestId("facilities-status-select")).toBeInTheDocument();
  });
});
