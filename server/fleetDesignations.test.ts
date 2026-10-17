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
    findPositionConflicts: vi.fn(async () => []),
    clearDriverFlag: vi.fn(async () => true),
  };
});
vi.mock("./_core/auditHelper", async (orig) => {
  const actual = await orig<typeof import("./_core/auditHelper")>();
  return { ...actual, logAuditEvent: vi.fn(async () => {}) };
});
vi.mock("./db", async (orig) => {
  const actual = await orig<typeof import("./db")>();
  // 7: active staff at site 3; 8: active staff, no facility; 9: inactive staff; 10: manager.
  const users: Record<number, { role: string; status: string; siteId: number | null }> = {
    7: { role: "staff", status: "active", siteId: 3 },
    8: { role: "staff", status: "active", siteId: null },
    9: { role: "staff", status: "inactive", siteId: 3 },
    10: { role: "manager", status: "active", siteId: 3 },
  };
  return {
    ...actual,
    getUserById: vi.fn(async (id: number) => ({ id, name: "U", email: "u@nrcs.org", ...users[id] })),
    updateUser: vi.fn(async () => {}),
  };
});

import * as audit from "./_core/auditHelper";
import * as fleetDb from "./fleetDesignationsDb";
import { isDriverEligible, isMissingTableError, normalisePositions } from "./fleetDesignationsDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;
function rootCaller(role: User["role"]) {
  const user = {
    id: 1, openId: "t", authUserId: null, email: "a@nrcs.org", name: "A", loginMethod: "supabase",
    role, siteId: 3, hasCompletedOnboarding: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as User;
  return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });
}
const caller = (role: User["role"]) => rootCaller(role).fleetDesignations;

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
    expect(fleetDb.replaceUserPositions).toHaveBeenCalledWith(7, next, 1, []);
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

  it("refuses a second holder and names the current one", async () => {
    vi.mocked(fleetDb.findPositionConflicts).mockResolvedValueOnce([
      { position: "head_of_fleet", siteId: null, holderUserId: 12, holderName: "Aisha Bello" },
    ]);
    await expect(caller("admin").setPositions({ userId: 7, positions: [{ position: "head_of_fleet" }] })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Head of Fleet is already held by Aisha Bello.",
    });
    expect(fleetDb.replaceUserPositions).not.toHaveBeenCalled();
    expect(audit.logAuditEvent).not.toHaveBeenCalled();
  });

  it("reassigns from the current holder and audits both users", async () => {
    const clash = { position: "branch_secretary" as const, siteId: 3, holderUserId: 12, holderName: "Aisha Bello" };
    vi.mocked(fleetDb.findPositionConflicts).mockResolvedValueOnce([clash]);
    vi.mocked(fleetDb.getUserDesignations).mockImplementation(async (id: number) =>
      id === 12
        ? { isDriver: false, positions: [{ position: "branch_secretary", siteId: 3 }, { position: "sg", siteId: null }] }
        : { isDriver: false, positions: [] }
    );
    await caller("admin").setPositions({ userId: 7, positions: [{ position: "branch_secretary" }], reassign: true });
    expect(fleetDb.replaceUserPositions).toHaveBeenCalledWith(7, [{ position: "branch_secretary", siteId: 3 }], 1, [clash]);
    const calls = vi.mocked(audit.logAuditEvent).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      entityId: 12,
      changes: {
        before: { positions: [{ position: "branch_secretary", siteId: 3 }, { position: "sg", siteId: null }] },
        after: { positions: [{ position: "sg", siteId: null }] },
        reassignedToUserId: 7,
      },
    });
    expect(calls[1]).toMatchObject({
      entityId: 7,
      changes: { after: { positions: [{ position: "branch_secretary", siteId: 3 }] }, reassignedFrom: [{ position: "branch_secretary", siteId: 3, userId: 12 }] },
    });
    vi.mocked(fleetDb.getUserDesignations).mockImplementation(async () => ({ isDriver: false, positions: [] }));
  });

  it("turns a unique-index race into a clear conflict", async () => {
    vi.mocked(fleetDb.replaceUserPositions).mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));
    await expect(caller("admin").setPositions({ userId: 7, positions: [{ position: "sg" }] })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only flags active staff users as drivers", async () => {
    expect(isDriverEligible({ role: "staff", status: "active" })).toBe(true);
    expect(isDriverEligible({ role: "staff", status: "inactive" })).toBe(false);
    expect(isDriverEligible({ role: "manager", status: "active" })).toBe(false);
    for (const userId of [9, 10]) {
      await expect(caller("admin").setDriver({ userId, isDriver: true })).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Only active staff users can be drivers.",
      });
    }
    expect(fleetDb.setDriverFlag).not.toHaveBeenCalled();
    // Unflagging is always allowed.
    vi.mocked(fleetDb.getUserDesignations).mockResolvedValueOnce({ isDriver: true, positions: [] });
    await expect(caller("admin").setDriver({ userId: 9, isDriver: false })).resolves.toMatchObject({ changed: true });
  });

  it("drops the driver flag when a user is deactivated, with an audit entry", async () => {
    await rootCaller("admin").users.deactivate({ id: 7 });
    expect(fleetDb.clearDriverFlag).toHaveBeenCalledWith(7);
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.driver_flag", entityId: 7, changes: expect.objectContaining({ after: { isDriver: false } }) })
    );
  });
});
