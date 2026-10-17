import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FRIENDLY_MESSAGES, UserFacingError } from "@shared/friendlyError";
import { formatTrpcErrorForClient, safeUserMessage } from "./friendlyTrpcError";

function shape(message: string, code: string) {
  return { message, code: -32603, data: { code, httpStatus: 500, path: "x.y", stack: "Error: secret\n    at a (b.ts:1:1)" } };
}

afterEach(() => vi.restoreAllMocks());

describe("formatTrpcErrorForClient (IVA-189)", () => {
  it("replaces internal errors, logs them and drops the stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create avatars bucket: Bucket quota" });
    const out = formatTrpcErrorForClient(shape(err.message, err.code), err, "auth.uploadAvatar");
    expect(out.message).toBe(FRIENDLY_MESSAGES.generic);
    expect(out.data.userFacing).toBe(false);
    expect("stack" in out.data).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it("maps a wrapped Postgres unique violation", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = Object.assign(new Error('duplicate key value violates unique constraint "assets_tag_key"'), { code: "23505" });
    const err = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: cause.message, cause });
    expect(formatTrpcErrorForClient(shape(err.message, err.code), err).message).toBe("That already exists.");
  });

  it("flags deliberate messages as userFacing", () => {
    const err = new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });
    const out = formatTrpcErrorForClient(shape(err.message, err.code), err);
    expect(out.message).toBe("Transfer not found");
    expect(out.data.userFacing).toBe(true);
  });

  it("hides raw text even under a deliberate code", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new TRPCError({ code: "BAD_REQUEST", message: 'insert into "x" Failed query: violates check constraint' });
    const out = formatTrpcErrorForClient(shape(err.message, err.code), err);
    expect(out.message).toBe(FRIENDLY_MESSAGES.validation);
    expect(out.data.userFacing).toBe(false);
  });

  it("turns Zod input errors into the validation line", () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: "x" });
    const err = new TRPCError({ code: "BAD_REQUEST", message: "bad", cause: parsed.error });
    expect(formatTrpcErrorForClient(shape(err.message, err.code), err).message).toBe(FRIENDLY_MESSAGES.validation);
  });

  it("unwraps a UserFacingError thrown from server code", () => {
    const err = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "x", cause: new UserFacingError("We couldn't read that Excel file.") });
    const out = formatTrpcErrorForClient(shape(err.message, err.code), err);
    expect(out.message).toBe("We couldn't read that Excel file.");
    expect(out.data.userFacing).toBe(true);
  });

  it("safeUserMessage keeps plain row errors and replaces raw ones", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(safeUserMessage(new Error("Asset tag and name are required"), "fallback", "t")).toBe("Asset tag and name are required");
    expect(safeUserMessage(new Error('Failed query: insert into "assets"'), "We couldn't import this row.", "t")).toBe(
      "We couldn't import this row."
    );
  });
});
