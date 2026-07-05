import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { extractTrpcProcedures } from "./_core/authRateLimit";

function mockRequest(partial: Pick<Request, "originalUrl" | "path">): Request {
  return partial as Request;
}

describe("extractTrpcProcedures", () => {
  it("parses a single procedure path", () => {
    const req = mockRequest({
      originalUrl: "/api/trpc/auth.loginWithPassword?batch=1",
      path: "/auth.loginWithPassword",
    });

    expect(extractTrpcProcedures(req)).toEqual(["auth.loginWithPassword"]);
  });

  it("parses comma-separated batched procedure paths", () => {
    const req = mockRequest({
      originalUrl: "/api/trpc/auth.loginWithPassword,auth.me?batch=1",
      path: "/auth.loginWithPassword,auth.me",
    });

    expect(extractTrpcProcedures(req)).toEqual([
      "auth.loginWithPassword",
      "auth.me",
    ]);
  });

  it("falls back to req.path when mounted under /api/trpc", () => {
    const req = mockRequest({
      originalUrl: "/api/trpc/auth.signup?batch=1",
      path: "/auth.signup",
    });

    expect(extractTrpcProcedures(req)).toEqual(["auth.signup"]);
  });

  it("returns empty for bare /api/trpc batch endpoint", () => {
    const req = mockRequest({
      originalUrl: "/api/trpc?batch=1",
      path: "/",
    });

    expect(extractTrpcProcedures(req)).toEqual([]);
  });
});
