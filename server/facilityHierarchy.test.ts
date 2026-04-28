import { describe, expect, it } from "vitest";
import type { FacilityType } from "../shared/facilities";
import { validateFacilityHierarchy } from "./facilityHierarchy";

function buildOptions(params: {
  parents: Record<number, { id: number; facilityType: FacilityType; parentFacilityId: number | null }>;
  cycle?: boolean;
  depthById?: Record<number, number>;
}) {
  return {
    getParentFacility: async (id: number) => params.parents[id] ?? null,
    wouldCreateCycle: async () => params.cycle ?? false,
    getDepth: async (id: number) => params.depthById?.[id] ?? 0,
  };
}

describe("validateFacilityHierarchy", () => {
  it("passes for NHQ without parent", async () => {
    await expect(
      validateFacilityHierarchy("national_headquarters", null, undefined, buildOptions({ parents: {} }))
    ).resolves.toBeUndefined();
  });

  it("throws for NHQ with parent", async () => {
    await expect(
      validateFacilityHierarchy(
        "national_headquarters",
        10,
        undefined,
        buildOptions({
          parents: { 10: { id: 10, facilityType: "national_headquarters", parentFacilityId: null } },
        })
      )
    ).rejects.toThrow("National headquarters cannot have a parent facility");
  });

  it("passes for branch with NHQ parent", async () => {
    await expect(
      validateFacilityHierarchy(
        "branch",
        10,
        undefined,
        buildOptions({
          parents: { 10: { id: 10, facilityType: "national_headquarters", parentFacilityId: null } },
        })
      )
    ).resolves.toBeUndefined();
  });

  it("throws for branch with no parent", async () => {
    await expect(
      validateFacilityHierarchy("branch", null, undefined, buildOptions({ parents: {} }))
    ).rejects.toThrow("branch requires a parent facility");
  });

  it("throws for branch with branch parent", async () => {
    await expect(
      validateFacilityHierarchy(
        "branch",
        11,
        undefined,
        buildOptions({
          parents: { 11: { id: 11, facilityType: "branch", parentFacilityId: 10 } },
        })
      )
    ).rejects.toThrow("branch parent must be national_headquarters");
  });

  it("passes for division with branch parent", async () => {
    await expect(
      validateFacilityHierarchy(
        "division",
        11,
        undefined,
        buildOptions({
          parents: { 11: { id: 11, facilityType: "branch", parentFacilityId: 10 } },
          depthById: { 11: 1 },
        })
      )
    ).resolves.toBeUndefined();
  });

  it("throws for division with NHQ parent", async () => {
    await expect(
      validateFacilityHierarchy(
        "division",
        10,
        undefined,
        buildOptions({
          parents: { 10: { id: 10, facilityType: "national_headquarters", parentFacilityId: null } },
        })
      )
    ).rejects.toThrow("division parent must be branch");
  });

  it("throws for division with no parent", async () => {
    await expect(
      validateFacilityHierarchy("division", null, undefined, buildOptions({ parents: {} }))
    ).rejects.toThrow("division requires a parent facility");
  });

  it("passes for warehouse with branch parent", async () => {
    await expect(
      validateFacilityHierarchy(
        "warehouse",
        11,
        undefined,
        buildOptions({
          parents: { 11: { id: 11, facilityType: "branch", parentFacilityId: 10 } },
          depthById: { 11: 1 },
        })
      )
    ).resolves.toBeUndefined();
  });

  it("passes for clinic with branch parent", async () => {
    await expect(
      validateFacilityHierarchy(
        "clinic",
        11,
        undefined,
        buildOptions({
          parents: { 11: { id: 11, facilityType: "branch", parentFacilityId: 10 } },
          depthById: { 11: 1 },
        })
      )
    ).resolves.toBeUndefined();
  });

  it("throws for self-parent", async () => {
    await expect(
      validateFacilityHierarchy(
        "branch",
        22,
        22,
        buildOptions({
          parents: { 22: { id: 22, facilityType: "national_headquarters", parentFacilityId: null } },
        })
      )
    ).rejects.toThrow("A facility cannot be its own parent");
  });
});

