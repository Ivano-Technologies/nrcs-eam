import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fleetDesignationsDb", async (orig) => {
  const actual = await orig<typeof import("./fleetDesignationsDb")>();
  return {
    ...actual,
    listFleetDesignations: vi.fn(async () => ({ available: true, driverUserIds: [], positions: [] })),
    getUserDesignations: vi.fn(async () => ({ isDriver: false, positions: [] })),
    setDriverFlag: vi.fn(async () => {}),
    replaceUserPositions: vi.fn(async () => {}),
  };
});
vi.mock("./_core/auditHelper", async (orig) => {
  const actual = await orig<typeof import("./_core/auditHelper")>();
  return { ...actual, logAuditEvent: vi.fn(async () => {}) };
});
vi.mock("./db", async (orig) => {
  const actual = await orig<typeof import("./db")>();
  return { ...actual, getUserById: vi.fn(async (id: number) => ({ id, siteId: id === 7 ? 3 : null, name: "U" })) };
});

import * as audit from "./_core/auditHelper";
import * as fleetDb from "./fleetDesignationsDb";
import { isMissingTableError, normalisePositions } from "./fleetDesignationsDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;
function caller(role: User["role"]) {
  const user = {
    id: 1, openId: "t", authUserId: null, email: "a@nrcs.org", name: "A", loginMethod: "supabase",
    role, siteId: 3, hasCompletedOnboarding: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as User;
  return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] })
    .fleetDesignations;
}

beforeEach(() => vi.clearAllMocks());

describe("normalisePositions (IVA-168)", () => {
  it("keeps org-wide positions facility-free and dedupes", () => {
    expect(
      normalisePositions([
        { position: "sg", siteId: 4 },
        { position: "head_of_fleet", siteId: null },
        { position: "head_of_fleet", siteId: null },
        { position: "branch_secretary", siteId: 3 },
      ])
    ).toEqual([
      { position: "branch_secretary", siteId: 3 },
      { position: "head_of_fleet", siteId: null },
      { position: "sg", siteId: null },
    ]);
  });
  it("rejects Branch Secretary without a facility", () => {
    expect(() => normalisePositions([{ position: "branch_secretary", siteId: null }])).toThrow();
  });
  it("recognises a missing-table error from migration 0061 not being applied", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ cause: { code: "42P01" } })).toBe(true);
    expect(isMissingTableError(new Error("x"))).toBe(false);
  });
});

describe("fleetDesignations router (IVA-168)", () => {
  it("is admin only", async () => {
    for (const role of ["manager", "staff", "field", "user"] as const) {
      await expect(caller(role).list()).rejects.toBeInstanceOf(TRPCError);
      await expect(caller(role).setDriver({ userId: 7, isDriver: true })).rejects.toThrow(/Insufficient permissions/);
    }
    expect(fleetDb.setDriverFlag).not.toHaveBeenCalled();
  });

  it("flags a driver and audits before and after", async () => {
    await expect(caller("admin").setDriver({ userId: 7, isDriver: true })).resolves.toEqual({ success: true, changed: true });
    expect(fleetDb.setDriverFlag).toHaveBeenCalledWith(7, true, 1);
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.driver_flag",
        entityId: 7,
        changes: { before: { isDriver: false }, after: { isDriver: true } },
      })
    );
  });

  it("sets positions, defaulting Branch Secretary to the user's facility, and audits", async () => {
    await caller("admin").setPositions({ userId: 7, positions: [{ position: "branch_secretary" }, { position: "head_of_fleet" }] });
    const next = [
      { position: "branch_secretary", siteId: 3 },
      { position: "head_of_fleet", siteId: null },
    ];
    expect(fleetDb.replaceUserPositions).toHaveBeenCalledWith(7, next, 1);
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.positions_update", changes: { before: { positions: [] }, after: { positions: next } } })
    );
  });

  it("refuses Branch Secretary for a user with no facility", async () => {
    await expect(
      caller("admin").setPositions({ userId: 8, positions: [{ position: "branch_secretary" }] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fleetDb.replaceUserPositions).not.toHaveBeenCalled();
  });

  it("does not write or audit when nothing changed", async () => {
    await expect(caller("admin").setDriver({ userId: 7, isDriver: false })).resolves.toEqual({ success: true, changed: false });
    expect(fleetDb.setDriverFlag).not.toHaveBeenCalled();
    expect(audit.logAuditEvent).not.toHaveBeenCalled();
  });

  it("explains a missing migration instead of a server error", async () => {
    vi.mocked(fleetDb.getUserDesignations).mockRejectedValueOnce(Object.assign(new Error("relation does not exist"), { code: "42P01" }));
    await expect(caller("admin").setDriver({ userId: 7, isDriver: true })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
