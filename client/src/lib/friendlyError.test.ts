import { TRPCClientError } from "@trpc/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FRIENDLY_MESSAGES, UserFacingError, looksLikeRawServerText } from "@shared/friendlyError";
import { friendlyMessage, toFriendlyError, toFriendlyMessage, toastError } from "./friendlyError";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

function trpcError(message: string, data: Record<string, unknown>) {
  return new TRPCClientError(message, { result: { error: { message, code: -32600, data } } } as never);
}

afterEach(() => vi.restoreAllMocks());

describe("friendlyMessage (IVA-189)", () => {
  it("uses the exact login copy", () => {
    expect(FRIENDLY_MESSAGES.invalidLogin).toBe("That email or password doesn't match. Check and try again.");
  });

  it("maps Supabase invalid login to plain English", () => {
    expect(friendlyMessage({ message: "Invalid login credentials", status: 400 })).toBe(FRIENDLY_MESSAGES.invalidLogin);
    expect(friendlyMessage(trpcError("Invalid email or password", { code: "UNAUTHORIZED", userFacing: true }))).toBe(
      FRIENDLY_MESSAGES.invalidLogin
    );
  });

  it("maps an expired session", () => {
    expect(friendlyMessage(trpcError("Please sign in (10001)", { code: "UNAUTHORIZED", userFacing: true }))).toBe(
      "Your session has expired. Please sign in again."
    );
    expect(friendlyMessage({ message: "JWT expired", code: "PGRST301" })).toBe(FRIENDLY_MESSAGES.sessionExpired);
  });

  it("maps permission denied", () => {
    expect(friendlyMessage(trpcError("Insufficient permissions", { code: "FORBIDDEN", userFacing: true }))).toBe(
      "You don't have permission to do that."
    );
    expect(friendlyMessage({ code: "42501", message: "permission denied for table assets" })).toBe(
      FRIENDLY_MESSAGES.permission
    );
    expect(friendlyMessage({ message: 'new row violates row-level security policy for table "x"' })).toBe(
      FRIENDLY_MESSAGES.permission
    );
  });

  it("maps not found", () => {
    expect(friendlyMessage({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" })).toBe(
      FRIENDLY_MESSAGES.notFound
    );
    expect(friendlyMessage({ status: 404, message: "Not Found" })).toBe(FRIENDLY_MESSAGES.notFound);
  });

  it("maps a unique violation to 'That already exists.'", () => {
    const pg = { code: "23505", message: 'duplicate key value violates unique constraint "assets_tag_key"' };
    expect(friendlyMessage(pg)).toBe("That already exists.");
    expect(friendlyMessage(new Error("Failed query: insert into ...", { cause: pg }))).toBe("That already exists.");
  });

  it("maps a foreign key violation", () => {
    const pg = { code: "23503", message: 'update or delete on table "sites" violates foreign key constraint' };
    expect(friendlyMessage(pg)).toBe("This is still in use by other records.");
  });

  it("maps validation errors", () => {
    expect(friendlyMessage({ code: "23502", message: 'null value in column "name" violates not-null constraint' })).toBe(
      FRIENDLY_MESSAGES.validation
    );
    expect(friendlyMessage(trpcError('[{"code":"invalid_type"}]', { code: "BAD_REQUEST", userFacing: false }))).toBe(
      FRIENDLY_MESSAGES.validation
    );
  });

  it("maps network and offline failures", () => {
    expect(friendlyMessage(new TypeError("Failed to fetch"))).toBe(
      "We couldn't reach the server. Check your connection and try again."
    );
    expect(friendlyMessage(new Error("NetworkError when attempting to fetch resource."))).toBe(FRIENDLY_MESSAGES.network);
  });

  it("maps rate limits", () => {
    expect(friendlyMessage(trpcError("Too many requests", { code: "TOO_MANY_REQUESTS", userFacing: true }))).toBe(
      FRIENDLY_MESSAGES.rateLimit
    );
    expect(friendlyMessage({ status: 429, message: "x" })).toBe(FRIENDLY_MESSAGES.rateLimit);
  });

  it("passes through deliberate server messages and UserFacingError", () => {
    expect(friendlyMessage(trpcError("Transfer not found", { code: "NOT_FOUND", userFacing: true }))).toBe(
      "Transfer not found"
    );
    expect(friendlyMessage(trpcError("A user with this email already exists", { code: "CONFLICT", userFacing: true }))).toBe(
      "A user with this email already exists"
    );
    expect(friendlyMessage(new UserFacingError("That photo is too large."))).toBe("That photo is too large.");
  });

  it("never passes through raw text even when flagged userFacing", () => {
    const raw = trpcError('relation "assets" does not exist', { code: "NOT_FOUND", userFacing: true });
    expect(friendlyMessage(raw)).toBe(FRIENDLY_MESSAGES.notFound);
    const raw2 = trpcError('Failed query: select * from "assets"', { code: "PRECONDITION_FAILED", userFacing: true });
    expect(friendlyMessage(raw2)).toBe(FRIENDLY_MESSAGES.generic);
  });

  it("hides Convex, HTTP and stack text behind the generic line or the fallback", () => {
    expect(friendlyMessage(new Error("[Request ID: abc123] Server Error Uncaught Error: boom"))).toBe(
      "Something went wrong. Please try again."
    );
    expect(friendlyMessage(new Error("TypeError: Cannot read properties of undefined (reading 'id')"))).toBe(
      FRIENDLY_MESSAGES.generic
    );
    expect(friendlyMessage(trpcError("boom", { code: "INTERNAL_SERVER_ERROR" }), "We couldn't save the asset. Please try again.")).toBe(
      "We couldn't save the asset. Please try again."
    );
    expect(friendlyMessage(undefined)).toBe(FRIENDLY_MESSAGES.generic);
  });

  it("logs the raw error with console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error('duplicate key value violates unique constraint "x"');
    expect(toFriendlyMessage(err)).toBe(FRIENDLY_MESSAGES.duplicate);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^\[error\] ref=[A-Z0-9]{8}$/), err);
  });

  it("returns { message, action, ref } and reuses the server ref", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fromServer = trpcError("boom", { code: "INTERNAL_SERVER_ERROR", userFacing: false, ref: "K7QM2XWA" });
    expect(toFriendlyError(fromServer)).toEqual({ message: FRIENDLY_MESSAGES.generic, action: "retry", ref: "K7QM2XWA" });
    expect(console.error).toHaveBeenCalledWith("[error] ref=K7QM2XWA", fromServer);
    const session = toFriendlyError(trpcError("Please sign in (10001)", { code: "UNAUTHORIZED", userFacing: true }));
    expect(session.action).toBe("signIn");
    expect(session.ref).toMatch(/^[A-Z0-9]{8}$/);
    const deliberate = toFriendlyError(trpcError("Transfer not found", { code: "NOT_FOUND", userFacing: true }));
    expect(deliberate.action).toBeUndefined();
  });

  it("uses the Sentry event id as the ref when Sentry is present", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    (window as unknown as { Sentry?: unknown }).Sentry = { captureException: () => "9f3c2a1be4d84f0a9c1d2e3f4a5b6c7d" };
    try {
      expect(toFriendlyError(new Error("x")).ref).toBe("9F3C2A1B");
    } finally {
      delete (window as unknown as { Sentry?: unknown }).Sentry;
    }
  });

  it("toastError shows the message with the ref as muted description", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = toastError(new TypeError("Failed to fetch"));
    expect(toast.error).toHaveBeenCalledWith(FRIENDLY_MESSAGES.network, {
      description: `Ref: ${result.ref}`,
      classNames: { description: expect.stringContaining("text-muted-foreground") },
    });
  });

  it("detects raw server text", () => {
    expect(looksLikeRawServerText("Failed query: select 1")).toBe(true);
    expect(looksLikeRawServerText("500 Internal Server Error")).toBe(true);
    expect(looksLikeRawServerText("    at foo (file.ts:1:2)")).toBe(true);
    expect(looksLikeRawServerText("Transfer not found")).toBe(false);
  });

  it("keeps every friendly line free of dashes used as punctuation", () => {
    for (const line of Object.values(FRIENDLY_MESSAGES)) {
      expect(line).not.toMatch(/[\u2010-\u2015-]/);
      expect(line[0]).toBe(line[0].toUpperCase());
    }
  });
});
