import type { TRPCError } from "@trpc/server";
import {
  FRIENDLY_MESSAGES,
  isUserFacingError,
  looksLikeRawServerText,
  mapErrorToFriendlyMessage,
} from "@shared/friendlyError";

type ShapeLike = {
  message: string;
  code: number;
  data: Record<string, unknown> & { code?: string; stack?: string };
};

function isZodError(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    ((cause as { name?: unknown }).name === "ZodError" || Array.isArray((cause as { issues?: unknown }).issues))
  );
}

/**
 * IVA-189 tRPC error formatter.
 * - Input validation (Zod) errors become the plain validation line instead of a JSON dump.
 * - INTERNAL_SERVER_ERROR, and any message that reads like raw server text (Postgres, Supabase,
 *   Drizzle, stack traces), is logged here and replaced with a plain English message.
 * - Every other TRPCError was written deliberately and is flagged `userFacing: true` so the client
 *   helper can show it as is.
 * - Stack traces are never sent.
 */
export function formatTrpcErrorForClient<S extends ShapeLike>(shape: S, error: TRPCError, path?: string): S {
  const { stack: _stack, ...data } = shape.data ?? {};
  if (isZodError(error.cause)) {
    return { ...shape, message: FRIENDLY_MESSAGES.validation, data: { ...data, userFacing: false } };
  }
  // Server code can throw UserFacingError anywhere; tRPC wraps it, so unwrap and show it as written.
  if (isUserFacingError(error.cause) && !looksLikeRawServerText(error.cause.message)) {
    return { ...shape, message: error.cause.message, data: { ...data, userFacing: true } };
  }
  const internal = error.code === "INTERNAL_SERVER_ERROR";
  if (internal || looksLikeRawServerText(error.message)) {
    console.error(
      JSON.stringify({
        type: "trpc_error",
        path: path ?? null,
        code: error.code,
        message: error.message,
        cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : undefined,
      })
    );
    if (error.cause && error.cause !== error) console.error(error.cause);
    // Keep the existing login retry signal working without exposing the raw text.
    const message = /temporarily unavailable/i.test(error.message)
      ? "The service is temporarily unavailable. Please try again."
      : mapErrorToFriendlyMessage(error.cause ?? error);
    return { ...shape, message, data: { ...data, userFacing: false } };
  }
  return { ...shape, data: { ...data, userFacing: true } };
}

/**
 * For values the server returns inside a successful response (for example per row import errors):
 * keep deliberate messages, log and replace anything that reads like raw server text.
 */
export function safeUserMessage(err: unknown, fallback: string, logTag: string): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (isUserFacingError(err) && !looksLikeRawServerText(err.message)) return err.message;
  if (message && !looksLikeRawServerText(message)) return message;
  console.error(`[${logTag}]`, err);
  return mapErrorToFriendlyMessage(err, fallback);
}
