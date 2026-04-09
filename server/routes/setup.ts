/**
 * One-time bootstrap: create first admin when `users` is empty.
 * Secured by `SETUP_SECRET` (send header `x-setup-secret`).
 * Remove or rotate secret after use in production.
 */
import { timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import { count } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";

const router = Router();

const ADMIN_EMAIL = "ivanonigeria@gmail.com";
const ADMIN_NAME = "Ivano Technologies";
/** Stable openId for pre-provisioned admin (matches magic-link / OAuth expectations). */
const ADMIN_OPEN_ID = "prod-admin-ivanonigeria-gmail";

function headerSecret(req: Request): string | undefined {
  const raw = req.headers["x-setup-secret"];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

function secretsMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Call only from a route handler — reads `process.env.SETUP_SECRET` at request time, not at module load. */
function readSetupSecretFromEnv(): string | undefined {
  return process.env.SETUP_SECRET?.trim();
}

router.post("/setup/create-admin", async (req, res) => {
  const expected = readSetupSecretFromEnv();
  if (!expected) {
    return res.status(503).json({
      error: "Setup disabled",
      detail: "SETUP_SECRET is not configured",
    });
  }

  const provided = headerSecret(req) ?? "";
  if (!secretsMatch(provided, expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  if (!db) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx.select({ total: count() }).from(users);
      const total = Number(row?.total ?? 0);
      if (total > 0) {
        throw Object.assign(new Error("ALREADY_EXISTS"), { code: "ALREADY_EXISTS" });
      }

      await tx.insert(users).values({
        openId: ADMIN_OPEN_ID,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        loginMethod: "magic_link",
        role: "admin",
        hasCompletedOnboarding: true,
      });
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "ALREADY_EXISTS") {
      return res.status(400).json({ error: "Admin already exists" });
    }
    console.error("[setup/create-admin]", e);
    return res.status(500).json({
      error: "Setup failed",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  return res.json({ success: true, email: ADMIN_EMAIL });
});

export default router;
