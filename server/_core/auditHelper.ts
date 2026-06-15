import { and, eq } from "drizzle-orm";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { users } from "../../drizzle/schema";
import * as db from "../db";
import { getDb } from "../db";

/** Sentinel userId when the actor is unknown (resolved to first active admin). */
export const AUDIT_UNKNOWN_ACTOR = 0;

export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: "auth.login_success",
  AUTH_LOGIN_FAILURE: "auth.login_failure",
  FACILITY_CREATE: "facility.create",
  FACILITY_UPDATE: "facility.update",
  FACILITY_DELETE: "facility.delete",
  REQUISITION_APPROVE_BRANCH: "requisition.approve_branch",
  REQUISITION_APPROVE_HQ: "requisition.approve_hq",
  REQUISITION_REJECT: "requisition.reject",
  REQUISITION_FULFILL: "requisition.fulfill",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DEACTIVATE: "user.deactivate",
  USER_DELETE: "user.delete",
  USER_RESET_PASSWORD: "user.reset_password",
  INVENTORY_GOODS_RECEIVED: "inventory.goods_received",
  INVENTORY_DISTRIBUTION: "inventory.distribution",
  INVENTORY_CYCLE_COUNT: "inventory.cycle_count",
  INVENTORY_ADJUSTMENT: "inventory.adjustment",
} as const;

type AuditReq = Pick<CreateExpressContextOptions["req"], "headers" | "socket"> & {
  ip?: string;
};

function headerValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string | undefined {
  const raw = headers?.[name];
  if (Array.isArray(raw)) return raw[0]?.trim() || undefined;
  return typeof raw === "string" ? raw.trim() || undefined : undefined;
}

export function extractClientIp(req?: AuditReq): string | undefined {
  if (!req) return undefined;
  if (typeof req.ip === "string" && req.ip.trim()) return req.ip.trim();
  const forwarded = headerValue(req.headers, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  const realIp = headerValue(req.headers, "x-real-ip");
  if (realIp) return realIp;
  return req.socket?.remoteAddress ?? undefined;
}

export function extractUserAgent(req?: AuditReq): string | undefined {
  return headerValue(req?.headers, "user-agent");
}

async function resolveAuditUserId(userId: number): Promise<number | null> {
  if (userId > 0) return userId;
  try {
    const database = await getDb();
    if (!database) return null;
    const [row] = await database
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.status, "active")))
      .limit(1);
    return row?.id ?? null;
  } catch (error) {
    console.error("[audit] Failed to resolve fallback admin userId:", error);
    return null;
  }
}

export async function logAuditEvent(params: {
  userId: number;
  action: string;
  entityType?: string;
  entityId?: number;
  changes?: Record<string, unknown>;
  req?: AuditReq;
}): Promise<void> {
  try {
    const resolvedUserId = await resolveAuditUserId(params.userId);
    if (resolvedUserId == null) return;

    await db.createAuditLog({
      userId: resolvedUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changes: params.changes ? JSON.stringify(params.changes) : undefined,
      ipAddress: extractClientIp(params.req),
      userAgent: extractUserAgent(params.req),
    });
  } catch (error) {
    console.error("[audit] Failed to write audit log:", error);
  }
}
