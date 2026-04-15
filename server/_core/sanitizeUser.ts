import type { User } from "../../drizzle/schema";

export type PublicUser = User;

export function toPublicUser(user: User): PublicUser {
  return user;
}

export function toPublicUsers(users: User[]): PublicUser[] {
  return users.map(toPublicUser);
}
