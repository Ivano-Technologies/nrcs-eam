/**
 * Full database reset: removes operational data, keeps admin app user (ivanonigeria@gmail.com).
 * Does NOT drop tables or touch __drizzle_migrations.
 *
 * Safety:
 *   - Requires --force to execute (otherwise prints preview and exits).
 *   - Requires confirmation unless --yes (type YES, or pass --yes).
 *   - Refuses NODE_ENV=production unless --force (same pattern as clean-test-data.ts).
 *
 * Supabase Auth: deletes all auth users except the admin email when
 * SUPABASE_URL + SUPABASE_SECRET_KEY are set.
 *
 * Usage:
 *   pnpm exec tsx scripts/db/full-reset.ts
 *   pnpm exec tsx scripts/db/full-reset.ts --force --yes
 */
import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { sql, eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb, resetDbConnection } from "../../server/db";

const ADMIN_EMAIL = "ivanonigeria@gmail.com";

const argv = process.argv.slice(2);
const hasForce = argv.includes("--force");
const hasYes = argv.includes("--yes");

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function assertCanRun(): void {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !hasForce) {
    console.error(
      "Refusing to run: NODE_ENV is production. Re-run with --force after explicit approval (e.g. Kezie)."
    );
    process.exit(1);
  }
}

function printPlan(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  NRCS EAM — FULL DATABASE RESET (preview)                        ║
╚══════════════════════════════════════════════════════════════════╝

Admin preserved: ${ADMIN_EMAIL}

All rows will be removed from operational tables, including:
  auditLogs, notifications, documents, assetPhotos,
  inventoryTransactions, maintenanceSchedules, workOrders, assetTransfers,
  scheduledReports, email_notifications, workOrderTemplates, assets,
  inventoryItems, email_templates, pending_users,
  notificationPreferences & userPreferences (non-admin only),
  all users except admin, sites, assetCategories

Tier 2B-retired tables (vendors, financialTransactions, complianceRecords,
budgets, maintenance_costs, retired accounting-config) are cleared only if still present.

Optional: activity_log (if the table exists).

NOT touched:
  __drizzle_migrations, app_settings

Sequences reset for empty tables; users id follows max(admin id).

Supabase: other Auth users deleted (same email exception) if the secret key is configured.

Run with:  pnpm exec tsx scripts/db/full-reset.ts --force
           pnpm exec tsx scripts/db/full-reset.ts --force --yes
`);
}

async function rawCount(db: Db, fromClause: string): Promise<number> {
  const r = await db.execute(sql.raw(`SELECT COUNT(*)::int AS c FROM ${fromClause}`));
  const rows = r as unknown as { c: number }[];
  return rows[0]?.c ?? 0;
}

async function tableExists(db: Db, tableName: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 AS ok FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
    LIMIT 1
  `);
  const rows = r as unknown as { ok: number }[];
  return rows.length > 0;
}

async function deleteAll(db: Db, label: string, fromClause: string): Promise<number> {
  const before = await rawCount(db, fromClause);
  await db.execute(sql.raw(`DELETE FROM ${fromClause}`));
  console.log(`  [delete] ${label}: ${before} row(s)`);
  return before;
}

/** Skip quietly when a table was dropped (e.g. Tier 2B migration 0056). */
async function deleteAllIfExists(
  db: Db,
  label: string,
  fromClause: string,
  tableName: string
): Promise<void> {
  if (!(await tableExists(db, tableName))) {
    console.log(`  [skip] ${label}: table not present (${tableName})`);
    return;
  }
  await deleteAll(db, label, fromClause);
}

/** Postgres: pg_get_serial_sequence first arg is text, e.g. public."workOrders" */
async function setvalEmpty(db: Db, tableRegclass: string): Promise<void> {
  await db.execute(
    sql.raw(`
      SELECT setval(
        pg_get_serial_sequence('${tableRegclass.replace(/'/g, "''")}', 'id'),
        1,
        false
      )
    `)
  );
}

async function main(): Promise<void> {
  if (!hasForce) {
    printPlan();
    console.log("No changes made. Pass --force to execute.\n");
    process.exit(0);
  }

  assertCanRun();

  if (!hasYes) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question('Type "YES" to destroy operational data (or run with --yes): ');
    rl.close();
    if (answer.trim() !== "YES") {
      console.log("Aborted.");
      process.exit(1);
    }
  }

  const db = await getDb();
  if (!db) {
    console.error("No database connection (check DATABASE_URL).");
    process.exit(1);
  }

  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
  if (!admin) {
    console.error(`Admin user ${ADMIN_EMAIL} not found — aborting.`);
    process.exit(1);
  }

  console.log("\n--- Deleting (order respects FKs) ---\n");

  await db.transaction(async (tx) => {
    const t = tx as unknown as Db;

    await t.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'activity_log'
        ) THEN
          DELETE FROM activity_log;
        END IF;
      END $$;
    `);

    await deleteAll(t, "auditLogs", `"auditLogs"`);
    await deleteAll(t, "notifications", `"notifications"`);
    await deleteAll(t, "documents", `"documents"`);
    await deleteAll(t, "assetPhotos", `"assetPhotos"`);
    await deleteAll(t, "inventoryTransactions", `"inventoryTransactions"`);
    await deleteAllIfExists(t, "financialTransactions", `"financialTransactions"`, "financialTransactions");
    await deleteAllIfExists(t, "complianceRecords", `"complianceRecords"`, "complianceRecords");
    await deleteAllIfExists(t, "maintenance_costs", `maintenance_costs`, "maintenance_costs");
    await deleteAllIfExists(t, "budgets", `budgets`, "budgets");
    await deleteAll(t, "maintenanceSchedules", `"maintenanceSchedules"`);
    await deleteAll(t, "workOrders", `"workOrders"`);
    await deleteAll(t, "assetTransfers", `"assetTransfers"`);
    await deleteAll(t, "scheduledReports", `"scheduledReports"`);
    await deleteAll(t, "email_notifications", `email_notifications`);
    await deleteAll(t, "workOrderTemplates", `"workOrderTemplates"`);

    await deleteAll(t, "assets", `"assets"`);
    await deleteAll(t, "inventoryItems", `"inventoryItems"`);
    await deleteAll(t, "email_templates", `email_templates`);

    await tx.execute(sql`UPDATE pending_users SET approved_by = NULL WHERE approved_by IS NOT NULL`);
    await deleteAll(t, "pending_users", `pending_users`);

    await tx.execute(sql`DELETE FROM "notificationPreferences" WHERE "userId" <> ${admin.id}`);
    console.log(`  [delete] notificationPreferences (non-admin): done`);
    await tx.execute(sql`DELETE FROM "userPreferences" WHERE "userId" <> ${admin.id}`);
    console.log(`  [delete] userPreferences (non-admin): done`);

    await tx.execute(sql`DELETE FROM users WHERE email <> ${ADMIN_EMAIL}`);
    console.log(`  [delete] users (non-admin): done`);

    await tx.execute(sql`UPDATE users SET "siteId" = NULL WHERE email = ${ADMIN_EMAIL}`);
    await deleteAllIfExists(t, "vendors", `"vendors"`, "vendors");
    await deleteAll(t, "sites", `sites`);
    await deleteAll(t, "assetCategories", `"assetCategories"`);
  });

  console.log("\n--- Resetting sequences ---\n");

  const emptyTables = [
    "public.\"auditLogs\"",
    "public.sites",
    "public.\"assets\"",
    "public.\"assetCategories\"",
    "public.\"inventoryItems\"",
    "public.\"workOrders\"",
    "public.\"maintenanceSchedules\"",
    "public.\"inventoryTransactions\"",
    "public.\"assetTransfers\"",
    "public.\"notifications\"",
    "public.\"documents\"",
    "public.\"assetPhotos\"",
    "public.\"scheduledReports\"",
    "public.email_notifications",
    "public.\"workOrderTemplates\"",
    "public.email_templates",
    "public.pending_users",
  ];

  const optionalEmptyTables = [
    { regclass: "public.\"vendors\"", name: "vendors" },
    { regclass: "public.\"financialTransactions\"", name: "financialTransactions" },
    { regclass: "public.\"complianceRecords\"", name: "complianceRecords" },
    { regclass: "public.maintenance_costs", name: "maintenance_costs" },
    { regclass: "public.budgets", name: "budgets" },
  ];

  for (const tbl of emptyTables) {
    try {
      await setvalEmpty(db, tbl);
      console.log(`  [seq] reset: ${tbl}`);
    } catch (e) {
      console.warn(`  [seq] skip ${tbl}:`, e instanceof Error ? e.message : e);
    }
  }

  for (const { regclass, name } of optionalEmptyTables) {
    if (!(await tableExists(db, name))) continue;
    try {
      await setvalEmpty(db, regclass);
      console.log(`  [seq] reset: ${regclass}`);
    } catch (e) {
      console.warn(`  [seq] skip ${regclass}:`, e instanceof Error ? e.message : e);
    }
  }

  try {
    await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('public."notificationPreferences"', 'id'),
        COALESCE((SELECT MAX("id") FROM "notificationPreferences"), 1),
        (SELECT MAX("id") FROM "notificationPreferences") IS NOT NULL
      )
    `);
    console.log(`  [seq] notificationPreferences`);
  } catch (e) {
    console.warn("  [seq] notificationPreferences:", e);
  }

  try {
    await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('public."userPreferences"', 'id'),
        COALESCE((SELECT MAX("id") FROM "userPreferences"), 1),
        (SELECT MAX("id") FROM "userPreferences") IS NOT NULL
      )
    `);
    console.log(`  [seq] userPreferences`);
  } catch (e) {
    console.warn("  [seq] userPreferences:", e);
  }

  try {
    await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('public.users', 'id'),
        COALESCE((SELECT MAX(id) FROM users), 1),
        (SELECT MAX(id) FROM users) IS NOT NULL
      )
    `);
    console.log(`  [seq] users`);
  } catch (e) {
    console.warn("  [seq] users:", e);
  }

  console.log("\n--- Supabase Auth (optional) ---\n");

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (supabaseUrl && secretKey) {
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let page = 1;
    const perPage = 200;
    let deleted = 0;
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("Supabase listUsers error:", error.message);
        break;
      }
      const list = data?.users ?? [];
      if (list.length === 0) break;
      for (const u of list) {
        const email = u.email?.toLowerCase();
        if (email === ADMIN_EMAIL.toLowerCase()) continue;
        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
        if (delErr) console.error(`deleteUser ${u.id}:`, delErr.message);
        else deleted++;
      }
      if (list.length < perPage) break;
      page++;
    }
    console.log(`  Supabase Auth users removed (except admin): ${deleted}`);
  } else {
    console.log("  Skipped (set SUPABASE_URL and SUPABASE_SECRET_KEY to prune Auth users).");
  }

  console.log("\n--- Verification counts ---\n");

  const verify = await db.execute(sql`
    SELECT 'sites' AS t, COUNT(*)::int AS c FROM sites
    UNION ALL SELECT 'assets', COUNT(*)::int FROM assets
    UNION ALL SELECT 'users', COUNT(*)::int FROM users
    UNION ALL SELECT 'inventory_items', COUNT(*)::int FROM "inventoryItems"
    UNION ALL SELECT 'work_orders', COUNT(*)::int FROM "workOrders"
    UNION ALL SELECT 'maintenance_schedules', COUNT(*)::int FROM "maintenanceSchedules"
    UNION ALL SELECT 'audit_logs', COUNT(*)::int FROM "auditLogs"
    UNION ALL SELECT 'notifications', COUNT(*)::int FROM "notifications"
    UNION ALL SELECT 'pending_users', COUNT(*)::int FROM pending_users
  `);

  const vrows = verify as unknown as { t: string; c: number }[];
  console.table(vrows);

  const urow = vrows.find((r) => r.t === "users");
  const bad = vrows.filter((r) => r.t !== "users" && r.c !== 0);
  if (bad.length > 0) {
    console.error("Unexpected non-zero counts:", bad);
    process.exit(1);
  }
  if (!urow || urow.c !== 1) {
    console.error(`Expected exactly 1 user (admin), got ${urow?.c ?? "?"}`);
    process.exit(1);
  }

  console.log("\nFull reset completed OK.\n");

  await resetDbConnection();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await resetDbConnection();
  process.exit(1);
});
