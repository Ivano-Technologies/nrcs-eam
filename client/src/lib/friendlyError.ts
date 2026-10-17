/**
 * IVA-189: the only way an error reaches the screen.
 *
 *   toastError(err, "We couldn't save the asset. Please try again.")
 *   const { message, ref } = toFriendlyError(err, fallback)   // inline errors
 *
 * - Messages the server deliberately wrote for the user (tRPC errors the formatter flags as
 *   userFacing) and UserFacingError instances pass through.
 * - Known cases map to plain English; everything else becomes the caller's fallback or
 *   "Something went wrong. Please try again."
 * - Every friendly error carries an 8 character support ref ("Ref: K7QM2XWA"). It is the server's
 *   ref for tRPC errors, else the Sentry or PostHog event id, else a fresh one. The raw error is
 *   logged with console.error next to the same ref so support can match them.
 */
import { toast } from "sonner";
import {
  FRIENDLY_MESSAGES,
  classifyError,
  generateErrorRef,
  isErrorRef,
  isUserFacingError,
  looksLikeRawServerText,
  mapErrorToFriendlyMessage,
  refFromId,
  type FriendlyErrorKind,
} from "@shared/friendlyError";

export { FRIENDLY_MESSAGES, UserFacingError } from "@shared/friendlyError";

export type FriendlyAction = "retry" | "signIn";

export type FriendlyError = {
  message: string;
  /** Suggested single next step, when there is an obvious one. */
  action?: FriendlyAction;
  /** 8 character support reference shown as "Ref: XXXXXXXX". */
  ref: string;
};

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

type TrpcLikeData = { code?: unknown; userFacing?: unknown; ref?: unknown };

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

/** The ref the server logged for this tRPC error, if any. */
export function serverRefOf(err: unknown): string | null {
  const ref = trpcData(err)?.ref;
  return isErrorRef(ref) ? ref : null;
}

type Reporter = { captureException?: (e: unknown, hint?: unknown) => unknown };

/**
 * Log the raw error with its ref and send it to Sentry or PostHog when present.
 * Returns the ref: the server's, else the reporter's event id, else a fresh one.
 */
export function reportError(err: unknown, context?: string, knownRef?: string | null): string {
  let ref = knownRef ?? serverRefOf(err);
  try {
    const w = typeof window !== "undefined" ? (window as unknown as { Sentry?: Reporter; posthog?: Reporter }) : undefined;
    const sentryId = w?.Sentry?.captureException?.(err, ref ? { tags: { ref } } : undefined);
    const posthogResult = w?.posthog?.captureException?.(err, { ...(ref ? { ref } : {}), ...(context ? { context } : {}) }) as
      | { uuid?: string }
      | undefined;
    ref = ref ?? refFromId(sentryId) ?? refFromId(posthogResult?.uuid) ?? generateErrorRef();
    console.error(`[error] ref=${ref}${context ? ` ${context}` : ""}`, err);
  } catch {
    ref = ref ?? generateErrorRef();
  }
  return ref;
}

function actionFor(kind: FriendlyErrorKind): FriendlyAction | undefined {
  if (kind === "sessionExpired") return "signIn";
  if (kind === "network" || kind === "rateLimit" || kind === "generic") return "retry";
  return undefined;
}

/** Pure message mapping, no logging. */
export function friendlyMessage(err: unknown, fallback?: string): string {
  if (isUserFacingError(err) && !looksLikeRawServerText(err.message)) return err.message;
  if (isServerUserMessage(err)) return (err as { message: string }).message;
  return mapErrorToFriendlyMessage(err, fallback);
}

/** Log the raw error and return { message, action?, ref } that is safe to show. */
export function toFriendlyError(err: unknown, fallback?: string, context?: string): FriendlyError {
  const ref = reportError(err, context);
  const message = friendlyMessage(err, fallback);
  const passthrough = (isUserFacingError(err) && message === err.message) || isServerUserMessage(err);
  const action = passthrough ? undefined : actionFor(classifyError(err));
  return action ? { message, action, ref } : { message, ref };
}

/** Shorthand when only the text is needed (the ref is still logged). */
export function toFriendlyMessage(err: unknown, fallback?: string): string {
  return toFriendlyError(err, fallback).message;
}

export const ERROR_REF_DESCRIPTION_CLASS = "!text-muted-foreground text-xs";

/** Error toast with the support ref in small muted text underneath. */
export function toastError(err: unknown, fallback?: string): FriendlyError {
  const friendly = toFriendlyError(err, fallback);
  toast.error(friendly.message, {
    description: `Ref: ${friendly.ref}`,
    classNames: { description: ERROR_REF_DESCRIPTION_CLASS },
  });
  return friendly;
}

export function isSessionExpiredError(err: unknown): boolean {
  return classifyError(err) === "sessionExpired";
}

export const GENERIC_ERROR_MESSAGE = FRIENDLY_MESSAGES.generic;
