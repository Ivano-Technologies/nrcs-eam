import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ctx(role: AuthenticatedUser["role"]): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    authUserId: null,
    email: "user@nrcs.org",
    name: "Test User",
    loginMethod: "supabase",
    role,
    siteId: null,
    hasCompletedOnboarding: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("inventory bulk access", () => {
  it("bulkSetActive is admin only", async () => {
    for (const role of ["manager", "staff"] as const) {
      await expect(
        appRouter.createCaller(ctx(role)).inventoryV2.catalogue.bulkSetActive({ ids: [1], isActive: false })
      ).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|UNAUTHORIZED/) });
    }
  });

  it("bulkSetReorderLevel rejects staff", async () => {
    await expect(
      appRouter
        .createCaller(ctx("staff"))
        .inventoryV2.stock.bulkSetReorderLevel({ items: [{ catalogueId: 1, warehouseId: 1 }], minLevel: 10 })
    ).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|UNAUTHORIZED/) });
  });

  it("bulkSetReorderLevel rejects negative levels and empty or oversized batches", async () => {
    const caller = appRouter.createCaller(ctx("admin"));
    await expect(caller.inventoryV2.stock.bulkSetReorderLevel({ items: [{ catalogueId: 1, warehouseId: 1 }], minLevel: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.inventoryV2.stock.bulkSetReorderLevel({ items: [], minLevel: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const many = Array.from({ length: 501 }, (_, i) => ({ catalogueId: i + 1, warehouseId: 1 }));
    await expect(caller.inventoryV2.stock.bulkSetReorderLevel({ items: many, minLevel: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
