import { randomInt } from "node:crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*";

function pick(set: string): string {
  return set[randomInt(set.length)]!;
}

/**
 * Random password suitable for Supabase policies: includes upper, lower, digit, and symbol.
 * Length defaults to 12 per product requirement.
 */
export function generateSupabaseCompliantTempPassword(length = 12): string {
  if (length < 12) {
    throw new Error("Temporary password length must be at least 12");
  }
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const pool = UPPER + LOWER + DIGITS + SYMBOLS;
  const rest: string[] = [];
  for (let i = required.length; i < length; i++) {
    rest.push(pick(pool));
  }
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const a = chars[i]!;
    const b = chars[j]!;
    chars[i] = b;
    chars[j] = a;
  }
  return chars.join("");
}
