/** Matches `drizzle/schema.ts` `user_role` enum (lowest → highest access). */
export const USER_ROLES = ["user", "staff", "manager", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
