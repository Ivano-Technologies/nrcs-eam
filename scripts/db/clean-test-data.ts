/**
 * Destructive cleanup of test/E2E rows in Postgres (Supabase).
 * Run against production only with explicit --force.
 *
 * Safety: refuses when NODE_ENV === "production" unless --force is passed.
 *
 * Usage:
 *   pnpm exec tsx scripts/db/clean-test-data.ts
 *   pnpm exec tsx scripts/db/clean-test-data.ts --force
 *
 * Requires DATABASE_URL (see .env).
 */
import "dotenv/config";
import { sql, eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb, resetDbConnection } from "../../server/db";

const ADMIN_EMAIL = "ivanonigeria@gmail.com";
const PROTECTED_SITE_IDS = [1, 2, 3] as const;

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function tableExists(db: Db, tableName: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 AS ok FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
    LIMIT 1
  `);
  const rows = r as unknown as { ok: number }[];
  return rows.length > 0;
}

function assertCanRun(): void {
  const force = process.argv.includes("--force");
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !force) {
    console.error(
      "Refusing to run: NODE_ENV is production. Re-run with --force after reviewing the DELETE statements."
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assertCanRun();

  const db = await getDb();
  if (!db) {
    console.error("No database connection (check DATABASE_URL).");
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    // --- Work orders: remove rows tied to missing sites or old null-site edge cases ---
    await tx.execute(sql`
      DELETE FROM "workOrders"
      WHERE "siteId" NOT IN (SELECT id FROM sites)
         OR ("siteId" IS NULL AND "createdAt" < NOW() - INTERVAL '1 day')
    `);

    // --- Work orders on sites we are about to remove ---
    await tx.execute(sql`
      DELETE FROM "workOrders"
      WHERE "siteId" IN (
        SELECT id FROM sites
        WHERE name NOT LIKE ${"NRCS%"}
          AND id NOT IN (${sql.join(PROTECTED_SITE_IDS.map((id) => sql`${id}`), sql`, `)})
      )
    `);

    // --- Inventory: transactions then items (test/E2E naming) ---
    await tx.execute(sql`
      DELETE FROM "inventoryTransactions"
      WHERE "itemId" IN (
        SELECT id FROM "inventoryItems"
        WHERE name LIKE ${"E2E%"}
           OR name LIKE ${"Test%"}
           OR name ILIKE ${"%test%"}
      )
    `);

    await tx.execute(sql`
      DELETE FROM "inventoryItems"
      WHERE name LIKE ${"E2E%"}
         OR name LIKE ${"Test%"}
         OR name ILIKE ${"%test%"}
    `);

    // --- Assets & dependents (matches requested patterns) ---
    await tx.execute(sql`
      DELETE FROM "workOrders"
      WHERE "assetId" IN (
        SELECT id FROM assets
        WHERE name LIKE ${"E2E%"}
           OR name LIKE ${"Test%"}
           OR name LIKE ${"QR Test%"}
           OR name LIKE ${"GPS Test%"}
           OR name LIKE ${"Scan Test%"}
           OR name ILIKE ${"%test%"}
           OR name ILIKE ${"%E2E%"}
      )
    `);

    await tx.execute(sql`
      DELETE FROM "maintenanceSchedules"
      WHERE "assetId" IN (
        SELECT id FROM assets
        WHERE name LIKE ${"E2E%"}
           OR name LIKE ${"Test%"}
           OR name LIKE ${"QR Test%"}
           OR name LIKE ${"GPS Test%"}
           OR name LIKE ${"Scan Test%"}
           OR name ILIKE ${"%test%"}
           OR name ILIKE ${"%E2E%"}
      )
    `);

    await tx.execute(sql`
      DELETE FROM assets
      WHERE name LIKE ${"E2E%"}
         OR name LIKE ${"Test%"}
         OR name LIKE ${"QR Test%"}
         OR name LIKE ${"GPS Test%"}
         OR name LIKE ${"Scan Test%"}
         OR name ILIKE ${"%test%"}
         OR name ILIKE ${"%E2E%"}
    `);

    // --- Pending signups (all) ---
    await tx.execute(sql`UPDATE pending_users SET approved_by = NULL WHERE approved_by IS NOT NULL`);
    await tx.execute(sql`DELETE FROM pending_users`);

    // --- Resolve FKs to users we are about to delete; keep admin ---
    const [admin] = await tx.select({ id: users.id }).from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
    if (!admin) {
      throw new Error(`Admin user ${ADMIN_EMAIL} not found — aborting user cleanup.`);
    }
    const adminId = admin.id;

    const nonAdminIds = sql`(SELECT id FROM users WHERE email <> ${ADMIN_EMAIL})`;

    await tx.execute(sql`UPDATE assets SET "assignedTo" = NULL WHERE "assignedTo" IN ${nonAdminIds}`);
    await tx.execute(sql`UPDATE "workOrders" SET "requestedBy" = ${adminId} WHERE "requestedBy" IN ${nonAdminIds}`);
    await tx.execute(sql`UPDATE "workOrders" SET "assignedTo" = NULL WHERE "assignedTo" IN ${nonAdminIds}`);
    await tx.execute(sql`UPDATE "maintenanceSchedules" SET "assignedTo" = NULL WHERE "assignedTo" IN ${nonAdminIds}`);
    await tx.execute(
      sql`UPDATE "inventoryTransactions" SET "performedBy" = ${adminId} WHERE "performedBy" IN ${nonAdminIds}`
    );
    if (await tableExists(tx as unknown as Db, "complianceRecords")) {
      await tx.execute(sql`UPDATE "complianceRecords" SET "assignedTo" = NULL WHERE "assignedTo" IN ${nonAdminIds}`);
    }
    if (await tableExists(tx as unknown as Db, "financialTransactions")) {
      await tx.execute(
        sql`UPDATE "financialTransactions" SET "createdBy" = ${adminId} WHERE "createdBy" IN ${nonAdminIds}`
      );
      await tx.execute(
        sql`UPDATE "financialTransactions" SET "approvedBy" = NULL WHERE "approvedBy" IN ${nonAdminIds}`
      );
    }
    await tx.execute(sql`UPDATE documents SET "uploadedBy" = ${adminId} WHERE "uploadedBy" IN ${nonAdminIds}`);
    await tx.execute(sql`UPDATE "assetPhotos" SET "uploadedBy" = ${adminId} WHERE "uploadedBy" IN ${nonAdminIds}`);
    await tx.execute(sql`UPDATE "scheduledReports" SET "createdBy" = ${adminId} WHERE "createdBy" IN ${nonAdminIds}`);
    await tx.execute(
      sql`UPDATE "assetTransfers" SET "requestedBy" = ${adminId} WHERE "requestedBy" IN ${nonAdminIds}`
    );
    await tx.execute(sql`UPDATE "assetTransfers" SET "approvedBy" = NULL WHERE "approvedBy" IN ${nonAdminIds}`);
    await tx.execute(
      sql`UPDATE "workOrderTemplates" SET "createdBy" = ${adminId} WHERE "createdBy" IN ${nonAdminIds}`
    );
    await tx.execute(sql`UPDATE "auditLogs" SET "userId" = ${adminId} WHERE "userId" IN ${nonAdminIds}`);
    await tx.execute(sql`UPDATE email_notifications SET "sentBy" = ${adminId} WHERE "sentBy" IN ${nonAdminIds}`);

    await tx.execute(sql`DELETE FROM notifications WHERE "userId" IN ${nonAdminIds}`);
    await tx.execute(sql`DELETE FROM "notificationPreferences" WHERE "userId" IN ${nonAdminIds}`);
    await tx.execute(sql`DELETE FROM "userPreferences" WHERE "userId" IN ${nonAdminIds}`);

    await tx.execute(sql`DELETE FROM users WHERE email <> ${ADMIN_EMAIL}`);

    // --- Point admin at a protected site if their site was removed ---
    await tx.execute(sql`
      UPDATE users
      SET "siteId" = (
        SELECT id FROM sites
        WHERE id IN (${sql.join(PROTECTED_SITE_IDS.map((id) => sql`${id}`), sql`, `)})
        ORDER BY id
        LIMIT 1
      )
      WHERE email = ${ADMIN_EMAIL}
        AND ("siteId" IS NULL OR "siteId" NOT IN (SELECT id FROM sites))
    `);

    // --- Non-NRCS sites (never drop protected ids) ---
    await tx.execute(sql`
      DELETE FROM sites
      WHERE name NOT LIKE ${"NRCS%"}
        AND id NOT IN (${sql.join(PROTECTED_SITE_IDS.map((id) => sql`${id}`), sql`, `)})
    `);
  });

  console.log("Cleanup transaction committed.");

  const verify = await db.execute(sql`
    SELECT 'sites' AS table_name, COUNT(*)::int AS count FROM sites
    UNION ALL
    SELECT 'assets', COUNT(*)::int FROM assets
    UNION ALL
    SELECT 'users', COUNT(*)::int FROM users
    UNION ALL
    SELECT 'pending_users', COUNT(*)::int FROM pending_users
    UNION ALL
    SELECT 'work_orders', COUNT(*)::int FROM "workOrders"
    UNION ALL
    SELECT 'inventoryItems', COUNT(*)::int FROM "inventoryItems"
  `);

  console.log("Row counts after cleanup:");
  console.table(verify);

  await resetDbConnection();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await resetDbConnection();
  process.exit(1);
});
