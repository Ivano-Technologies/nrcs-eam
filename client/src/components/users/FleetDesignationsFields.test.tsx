import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FleetDesignationBadges, FleetDesignationsFields } from "./FleetDesignationsFields";

afterEach(() => cleanup());

describe("FleetDesignationsFields (IVA-168)", () => {
  it("toggles the driver flag and positions", async () => {
    const onChange = vi.fn();
    render(
      <FleetDesignationsFields available value={{ isDriver: false, positions: [] }} facilityName="Abuja HQ" onChange={onChange} />
    );
    await userEvent.click(screen.getByRole("switch", { name: "Driver" }));
    expect(onChange).toHaveBeenLastCalledWith({ isDriver: true, positions: [] });
    await userEvent.click(screen.getByRole("checkbox", { name: "Head of Fleet" }));
    expect(onChange).toHaveBeenLastCalledWith({ isDriver: false, positions: ["head_of_fleet"] });
    expect(screen.getByRole("checkbox", { name: "Branch Secretary · Abuja HQ" })).toBeEnabled();
    expect(screen.getByText("GM Assets/Admin")).toBeInTheDocument();
    expect(screen.getByText("SG")).toBeInTheDocument();
  });

  it("blocks Branch Secretary until the user has a facility", () => {
    render(
      <FleetDesignationsFields available value={{ isDriver: false, positions: [] }} facilityName={null} onChange={vi.fn()} />
    );
    expect(screen.getByRole("checkbox", { name: "Branch Secretary" })).toBeDisabled();
    expect(screen.getByText("Set a facility first.")).toBeInTheDocument();
  });

  it("explains when migration 0061 is not applied yet", () => {
    render(<FleetDesignationsFields available={false} value={{ isDriver: false, positions: [] }} facilityName={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("fleet-designations-unavailable")).toHaveTextContent("migration 0061");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows Driver and position badges in the table", () => {
    render(
      <FleetDesignationBadges
        isDriver
        positions={[
          { position: "branch_secretary", siteName: "Kano Branch" },
          { position: "sg", siteName: null },
        ]}
      />
    );
    expect(screen.getByText("Driver")).toBeInTheDocument();
    expect(screen.getByText("Branch Secretary · Kano Branch")).toBeInTheDocument();
    expect(screen.getByText("SG")).toBeInTheDocument();
  });

  it("names the current holder on a clash and offers to reassign", async () => {
    const onReassignChange = vi.fn();
    const { rerender } = render(
      <FleetDesignationsFields
        available
        value={{ isDriver: false, positions: ["head_of_fleet"] }}
        facilityName="Abuja HQ"
        onChange={vi.fn()}
        userName="Ibrahim Musa"
        conflicts={[{ position: "head_of_fleet", holderName: "Aisha Bello" }]}
        reassign={[]}
        onReassignChange={onReassignChange}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Aisha Bello already holds this position. Each position has one holder.");
    await userEvent.click(screen.getByRole("button", { name: "Reassign to Ibrahim Musa" }));
    expect(onReassignChange).toHaveBeenCalledWith(["head_of_fleet"]);
    rerender(
      <FleetDesignationsFields
        available
        value={{ isDriver: false, positions: ["head_of_fleet"] }}
        facilityName="Abuja HQ"
        onChange={vi.fn()}
        userName="Ibrahim Musa"
        conflicts={[{ position: "head_of_fleet", holderName: "Aisha Bello" }]}
        reassign={["head_of_fleet"]}
        onReassignChange={onReassignChange}
      />
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("position-reassign-head_of_fleet")).toHaveTextContent("Moves from Aisha Bello to Ibrahim Musa when you save.");
  });

  it("disables the driver switch for users who aren't active staff", () => {
    render(
      <FleetDesignationsFields available value={{ isDriver: true, positions: [] }} facilityName={null} onChange={vi.fn()} driverEligible={false} />
    );
    const sw = screen.getByRole("switch", { name: "Driver" });
    expect(sw).toBeDisabled();
    expect(sw).not.toBeChecked();
    expect(screen.getByText("Only active staff users can be drivers.")).toBeInTheDocument();
  });
});
