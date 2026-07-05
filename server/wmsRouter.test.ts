import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(role: AuthenticatedUser["role"]): TrpcContext {
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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("WMS CTN access control", () => {
  it('returns UNAUTHORIZED for role "user" on ctn.create', async () => {
    const caller = appRouter.createCaller(createTestContext("user"));

    await expect(
      caller.wms.ctn.create({
        ctnCode: "CTN-TEST-001",
        donorId: 1,
        itemId: 1,
        unit: "EA",
        originalQuantity: 10,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Insufficient permissions",
    } satisfies Partial<TRPCError>);
  });
});
