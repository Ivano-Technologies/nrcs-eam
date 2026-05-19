import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import {
  COOKIE_NAME,
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
} from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "supabase",
    role: "user",
    authUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    siteId: null,
    hasCompletedOnboarding: true,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears Supabase and legacy session cookies and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    const names = clearedCookies.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        COOKIE_NAME,
        SUPABASE_ACCESS_TOKEN_COOKIE,
        SUPABASE_REFRESH_TOKEN_COOKIE,
      ].sort()
    );
    for (const c of clearedCookies) {
      expect(c.options).toMatchObject({
        secure: true,
        sameSite: "none",
        httpOnly: true,
        path: "/",
      });
      expect(c.options).not.toHaveProperty("maxAge");
    }
  });
});
