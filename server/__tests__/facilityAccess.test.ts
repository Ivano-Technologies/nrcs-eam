import { describe, it, expect } from "vitest";
import {
  assertFacilityAccess,
  assertRecordFacilityAccess,
  enforceFacilityScope,
} from "../_core/facilityAccess";
import { TRPCError } from "@trpc/server";

describe("assertRecordFacilityAccess", () => {
  it("allows manager to access any facility record", () => {
    expect(() =>
      assertRecordFacilityAccess({ role: "manager", siteId: 1 }, 99)
    ).not.toThrow();
  });

  it("allows admin to access any facility record", () => {
    expect(() =>
      assertRecordFacilityAccess({ role: "admin", siteId: null }, 99)
    ).not.toThrow();
  });

  it("allows staff to access their own facility record", () => {
    expect(() =>
      assertRecordFacilityAccess({ role: "staff", siteId: 5 }, 5)
    ).not.toThrow();
  });

  it("blocks staff from accessing another facility record", () => {
    expect(() =>
      assertRecordFacilityAccess({ role: "staff", siteId: 5 }, 99)
    ).toThrow(TRPCError);
  });

  it("blocks field user from accessing another facility record", () => {
    expect(() =>
      assertRecordFacilityAccess({ role: "field", siteId: 5 }, 99)
    ).toThrow(TRPCError);
  });

  it("blocks unknown role from accessing any facility record", () => {
    expect(() =>
      assertRecordFacilityAccess({ role: "user", siteId: 5 }, 99)
    ).toThrow(TRPCError);
  });

  it("blocks unknown role with null siteId", () => {
    expect(() =>
      assertRecordFacilityAccess({ role: "user", siteId: null }, 99)
    ).toThrow(TRPCError);
  });

  it("passes when recordSiteId is null regardless of role", () => {
    expect(() =>
      assertRecordFacilityAccess({ role: "user", siteId: null }, null)
    ).not.toThrow();
  });
});

describe("enforceFacilityScope", () => {
  it("returns client siteId for manager", () => {
    expect(enforceFacilityScope({ role: "manager", siteId: 1 }, 99)).toBe(99);
  });

  it("returns own siteId for staff regardless of client input", () => {
    expect(enforceFacilityScope({ role: "staff", siteId: 5 }, 99)).toBe(5);
  });

  it("returns -1 for staff with no assigned facility", () => {
    expect(enforceFacilityScope({ role: "staff", siteId: null })).toBe(-1);
  });

  it("returns -1 for unknown role", () => {
    expect(enforceFacilityScope({ role: "user", siteId: 5 })).toBe(-1);
  });
});
