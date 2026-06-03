import { and, eq, gte } from "drizzle-orm";
import { notifications, type InsertNotification } from "../../drizzle/schema";
import { createNotification, getDb } from "../db";

const DEFAULT_DEDUP_HOURS = 24;

export async function hasRecentNotification(params: {
  userId: number;
  type: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  withinHours?: number;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const since = new Date(Date.now() - (params.withinHours ?? DEFAULT_DEDUP_HOURS) * 60 * 60 * 1000);
  const filters = [
    eq(notifications.userId, params.userId),
    eq(notifications.type, params.type as InsertNotification["type"]),
    gte(notifications.createdAt, since),
  ];
  if (params.relatedEntityType != null) {
    filters.push(eq(notifications.relatedEntityType, params.relatedEntityType));
  }
  if (params.relatedEntityId != null) {
    filters.push(eq(notifications.relatedEntityId, params.relatedEntityId));
  }
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(...filters))
    .limit(1);
  return rows.length > 0;
}

export async function createNotificationDeduped(
  notification: Parameters<typeof createNotification>[0],
  options?: { withinHours?: number }
): Promise<number | null> {
  if (!notification.userId || !notification.type) return createNotification(notification);
  const duplicate = await hasRecentNotification({
    userId: notification.userId,
    type: notification.type,
    relatedEntityType: notification.relatedEntityType ?? null,
    relatedEntityId: notification.relatedEntityId ?? null,
    withinHours: options?.withinHours,
  });
  if (duplicate) return null;
  return createNotification(notification);
}
