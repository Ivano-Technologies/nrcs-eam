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
});
