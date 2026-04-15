// @ts-nocheck
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
import { getSupabaseServiceRole } from "../_core/supabase";

const router = Router();

const ADMIN_EMAIL = "ivanonigeria@gmail.com";
const ADMIN_NAME = "Ivano Technologies";

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

/** Health check for setup routes (no secret). */
router.get("/setup/ping", (_req, res) => {
  res.status(200).json({ ok: true, service: "setup" });
});

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

      const supabase = getSupabaseServiceRole();
      const { data, error } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        email_confirm: true,
        user_metadata: { full_name: ADMIN_NAME },
      });
      if (error || !data.user) {
        throw Object.assign(
          new Error(error?.message ?? "Supabase createUser failed"),
          { code: "SUPABASE_ERROR" }
        );
      }

      await tx.insert(users).values({
        openId: data.user.id,
        authUserId: data.user.id,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        loginMethod: "supabase",
        role: "admin",
        hasCompletedOnboarding: true,
      });
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "ALREADY_EXISTS") {
      return res.status(400).json({ error: "Admin already exists" });
    }
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "SUPABASE_ERROR") {
      return res.status(503).json({
        error: "Supabase admin API failed",
        detail: e instanceof Error ? e.message : String(e),
      });
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
