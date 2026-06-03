import { z } from "zod";

export const LIST_LIMIT_DEFAULT = 100;
export const LIST_LIMIT_MAX = 500;

export const listPaginationInput = z.object({
  limit: z.number().int().min(1).max(LIST_LIMIT_MAX).optional(),
  offset: z.number().int().min(0).optional(),
});

export function resolveListLimit(limit?: number): number {
  return Math.min(limit ?? LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX);
}

export function resolveListOffset(offset?: number): number {
  return Math.max(0, offset ?? 0);
}
