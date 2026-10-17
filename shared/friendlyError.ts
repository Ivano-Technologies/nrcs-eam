/**
 * IVA-189: one place that turns any error into plain English for the screen.
 *
 * Shared by the client (toasts, alerts, inline errors) and the server (tRPC error formatter and
 * REST handlers) so both sides agree on what is safe to show. Raw server text (Supabase and
 * PostgREST errors, Postgres codes, Drizzle "Failed query" text, HTTP status text, stack traces)
 * never reaches the user; it is logged instead.
 */

export const FRIENDLY_MESSAGES = {
  invalidLogin: "That email or password doesn't match. Check and try again.",
  sessionExpired: "Your session has expired. Please sign in again.",
  permission: "You don't have permission to do that.",
  notFound: "We couldn't find that. It may have been moved or deleted.",
  duplicate: "That already exists.",
  inUse: "This is still in use by other records.",
  validation: "Some details aren't valid. Please check them and try again.",
  network: "We couldn't reach the server. Check your connection and try again.",
  rateLimit: "Too many attempts. Please wait a moment and try again.",
  generic: "Something went wrong. Please try again.",
} as const;

export type FriendlyErrorKind = keyof typeof FRIENDLY_MESSAGES;

/**
 * A message the app deliberately wrote for the user. Anything thrown as a UserFacingError is
 * shown as is; everything else goes through classification.
 */
export class UserFacingError extends Error {
  readonly userFacing = true as const;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "UserFacingError";
    if (options && "cause" in options) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isUserFacingError(err: unknown): err is UserFacingError {
  return (
    err instanceof UserFacingError ||
    (typeof err === "object" && err !== null && (err as { userFacing?: unknown }).userFacing === true &&
      typeof (err as { message?: unknown }).message === "string")
  );
}

/** Text that only a server, database or runtime would produce. Never shown to the user. */
const RAW_PATTERNS: RegExp[] = [
  /\[Request ID: [^\]]*\]/i,
  /\bServer Error\b/i,
  /Uncaught\b/i,
  /\bFailed query:/i,
  /\bduplicate key value\b/i,
  /\bviolates (unique|foreign key|not-null|check) constraint\b/i,
  /\b(relation|column|function|schema|table) "[^"]*" (does not exist|already exists)\b/i,
  /\bsyntax error at or near\b/i,
  /\binvalid input (syntax|value) for\b/i,
  /\bpermission denied for\b/i,
  /\brow[- ]level security\b/i,
  /\bPGRST\d{3}\b/,
  /\bSQLSTATE\b/i,
  /\bpostgres(ql)?\b/i,
  /\bdrizzle\b/i,
  /\bsupabase\b/i,
  /\bJWT\b/,
  /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE)\b/,
  /\b(TypeError|ReferenceError|SyntaxError|RangeError):/,
  /\bCannot read propert(y|ies) of\b/i,
  /\bis not a function\b/i,
  /\bundefined is not\b/i,
  /\bUnexpected token\b/i,
  /\bin JSON at position\b/i,
  /^\s*at .+:\d+:\d+\)?\s*$/m,
  /<!DOCTYPE|<html/i,
  /^\s*[[{]/,
  /^\s*\d{3}\s*(:|\b[A-Z])/,
  /\b(Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b/i,
  /\bbucket\b/i,
  /\bstorage\b.*\berror\b/i,
];

export function looksLikeRawServerText(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  if (text.length > 300) return true;
  return RAW_PATTERNS.some((re) => re.test(text));
}

function readString(obj: unknown, key: string): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

function readNumber(obj: unknown, key: string): number | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "number" ? v : undefined;
}

/** Walk err, err.cause, err.data and err.shape.data collecting codes, statuses and messages. */
function collect(err: unknown) {
  const codes: string[] = [];
  const statuses: number[] = [];
  const messages: string[] = [];
  const seen = new Set<unknown>();
  const visit = (e: unknown, depth: number) => {
    if (e == null || depth > 5 || seen.has(e)) return;
    if (typeof e === "string") {
      messages.push(e);
      return;
    }
    if (typeof e !== "object") return;
    seen.add(e);
    for (const key of ["code", "sqlState", "errorCode", "error_code"]) {
      const s = readString(e, key);
      if (s) codes.push(s);
    }
    for (const key of ["status", "statusCode", "httpStatus"]) {
      const n = readNumber(e, key);
      if (n) statuses.push(n);
    }
    for (const key of ["message", "error_description", "details", "hint", "error"]) {
      const s = readString(e, key);
      if (s) messages.push(s);
    }
    const rec = e as Record<string, unknown>;
    visit(rec.cause, depth + 1);
    visit(rec.data, depth + 1);
    visit(rec.shape, depth + 1);
    if (typeof rec.error === "object") visit(rec.error, depth + 1);
    if (typeof rec.response === "object") visit(rec.response, depth + 1);
  };
  visit(err, 0);
  return { codes, statuses, messages };
}

/** Sort an error into one of the plain English buckets. */
export function classifyError(err: unknown): FriendlyErrorKind {
  const { codes, statuses, messages } = collect(err);
  const text = messages.join(" \n ");
  const has = (re: RegExp) => re.test(text);
  const code = (...values: string[]) => codes.some((c) => values.includes(c));
  const status = (...values: number[]) => statuses.some((s) => values.includes(s));

  // Network and offline first: there is no server answer to read.
  if (
    has(/Failed to fetch|NetworkError|Network request failed|Load failed|fetch failed|ERR_NETWORK|ERR_INTERNET_DISCONNECTED|\boffline\b/i) ||
    code("ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ERR_NETWORK")
  ) {
    return "network";
  }
  if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) return "network";

  if (code("TOO_MANY_REQUESTS", "over_request_rate_limit", "over_email_send_rate_limit") || status(429) ||
    has(/rate limit|too many requests|too many attempts/i)) {
    return "rateLimit";
  }

  if (has(/invalid login credentials|invalid email or password|invalid_credentials|wrong password/i) ||
    code("invalid_credentials")) {
    return "invalidLogin";
  }

  if (
    has(/please sign in \(10001\)|jwt expired|session (has )?expired|refresh token|auth session missing|not authenticated|session_not_found/i) ||
    code("PGRST301", "PGRST302", "session_expired", "session_not_found", "refresh_token_not_found", "bad_jwt")
  ) {
    return "sessionExpired";
  }

  if (code("23505") || code("CONFLICT") || status(409) ||
    has(/duplicate key|unique constraint|already exists|already been registered|already registered/i)) {
    return "duplicate";
  }

  if (code("23503") || has(/violates foreign key constraint|still referenced|is still in use/i)) {
    return "inUse";
  }

  if (code("42501", "FORBIDDEN") || status(403) ||
    has(/permission denied|row[- ]level security|insufficient permissions|not authori[sz]ed|forbidden|do not have permission/i)) {
    return "permission";
  }
  if (code("UNAUTHORIZED") || status(401)) return "sessionExpired";

  // Text match only for plain messages: "Bucket not found" from storage is a server problem, not the user's.
  if (code("PGRST116", "NOT_FOUND") || status(404) || has(/no rows returned/i) ||
    (has(/\bnot found\b/i) && !looksLikeRawServerText(text))) {
    return "notFound";
  }

  if (
    code("23502", "23514", "22P02", "22001", "22003", "22007", "22008", "PARSE_ERROR", "BAD_REQUEST", "validation_failed") ||
    status(400, 422) ||
    has(/invalid input|violates (not-null|check) constraint|value too long|ZodError|invalid_type|validation/i)
  ) {
    return "validation";
  }

  if (code("TIMEOUT") || status(408, 504) || has(/timed? ?out/i)) return "network";

  return "generic";
}

export function friendlyMessageFor(kind: FriendlyErrorKind): string {
  return FRIENDLY_MESSAGES[kind];
}

/**
 * Pure mapping, no logging. Order:
 * 1. A UserFacingError (or anything flagged userFacing) shows its own message.
 * 2. A known case maps to its plain English line.
 * 3. Otherwise the caller's fallback, then the generic line.
 */
export function mapErrorToFriendlyMessage(err: unknown, fallback?: string): string {
  if (isUserFacingError(err) && !looksLikeRawServerText(err.message)) return err.message;
  const kind = classifyError(err);
  if (kind !== "generic") return FRIENDLY_MESSAGES[kind];
  return fallback && fallback.trim() ? fallback : FRIENDLY_MESSAGES.generic;
}

/** Characters for support refs: no 0/O or 1/I/L so they read clearly over the phone. */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ERROR_REF_LENGTH = 8;

/** A fresh 8 character support reference, for example "K7QM2XWA". */
export function generateErrorRef(): string {
  const bytes = new Uint8Array(ERROR_REF_LENGTH);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return out;
}

/** Turn an event or request id (Sentry, PostHog uuid) into an 8 character ref. */
export function refFromId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const compact = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return compact.length >= ERROR_REF_LENGTH ? compact.slice(0, ERROR_REF_LENGTH) : null;
}

export function isErrorRef(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9]{8}$/.test(value);
}
