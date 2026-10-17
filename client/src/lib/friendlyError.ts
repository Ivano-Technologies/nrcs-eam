/**
 * IVA-189: the only way an error reaches the screen.
 *
 *   toast.error(toFriendlyMessage(err, "We couldn't save the asset. Please try again."))
 *
 * - Messages the server deliberately wrote for the user (tRPC errors the formatter flags as
 *   userFacing) and UserFacingError instances pass through.
 * - Known cases (session expired, permission, duplicate, in use, not found, validation, network,
 *   rate limit, invalid login) map to plain English.
 * - Everything else becomes the caller's fallback, or "Something went wrong. Please try again."
 * The raw error is always logged with console.error and sent to PostHog or Sentry when present.
 */
import {
  FRIENDLY_MESSAGES,
  classifyError,
  isUserFacingError,
  looksLikeRawServerText,
  mapErrorToFriendlyMessage,
} from "@shared/friendlyError";

export { FRIENDLY_MESSAGES, UserFacingError } from "@shared/friendlyError";

/** tRPC codes whose deliberate server messages are safe and useful to show as written. */
const PASS_THROUGH_TRPC_CODES = new Set([
  "BAD_REQUEST",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "UNPROCESSABLE_CONTENT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "METHOD_NOT_SUPPORTED",
]);

type TrpcLikeData = { code?: unknown; userFacing?: unknown };

function trpcData(err: unknown): TrpcLikeData | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const data = (err as { data?: unknown }).data ?? (err as { shape?: { data?: unknown } }).shape?.data;
  return typeof data === "object" && data !== null ? (data as TrpcLikeData) : undefined;
}

/** True when the server flagged this message as written for the user. */
export function isServerUserMessage(err: unknown): boolean {
  const data = trpcData(err);
  if (!data || data.userFacing !== true) return false;
  if (typeof data.code !== "string" || !PASS_THROUGH_TRPC_CODES.has(data.code)) return false;
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && !looksLikeRawServerText(message);
}

export function reportError(err: unknown, context?: string): void {
  try {
    console.error(context ? `[error] ${context}` : "[error]", err);
    const w = typeof window !== "undefined" ? (window as unknown as Record<string, any>) : undefined;
    if (w?.Sentry?.captureException) w.Sentry.captureException(err, context ? { tags: { context } } : undefined);
    if (w?.posthog?.captureException) w.posthog.captureException(err, context ? { context } : undefined);
  } catch {
    // Reporting must never break the screen.
  }
}

/** Pure version for tests and places that already logged. */
export function friendlyMessage(err: unknown, fallback?: string): string {
  if (isUserFacingError(err) && !looksLikeRawServerText(err.message)) return err.message;
  if (isServerUserMessage(err)) return (err as { message: string }).message;
  return mapErrorToFriendlyMessage(err, fallback);
}

export function toFriendlyMessage(err: unknown, fallback?: string): string {
  reportError(err);
  return friendlyMessage(err, fallback);
}

export function isSessionExpiredError(err: unknown): boolean {
  return classifyError(err) === "sessionExpired";
}

export const GENERIC_ERROR_MESSAGE = FRIENDLY_MESSAGES.generic;
