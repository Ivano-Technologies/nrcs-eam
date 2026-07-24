#!/usr/bin/env node
/**
 * Database Reset Script
 * Clears all sample data from tables while preserving schema (PostgreSQL).
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { prepare: false, max: 5 });
const db = drizzle(client);

/** Tier 2B (migration 0056) — truncated only when still present (pre-migration DBs). */
const TIER_2B_RETIRED_TABLES = [
  "complianceRecords",
  "financialTransactions",
  "vendors",
  "budgets",
  "maintenance_costs",
];

const CORE_TABLES = [
  "assetPhotos",
  "scheduledReports",
  "notificationPreferences",
  "notifications",
  "documents",
  "auditLogs",
  "inventoryTransactions",
  "inventoryItems",
  "maintenanceSchedules",
  "workOrders",
  "assets",
  "assetCategories",
  "sites",
];

async function tableExists(tableName) {
  const rows = await client`
    SELECT 1 AS ok FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function resolveTruncateTables() {
  const tables = [...CORE_TABLES];
  for (const name of TIER_2B_RETIRED_TABLES) {
    if (await tableExists(name)) {
      tables.push(name);
    }
  }
  return tables;
}

async function resetDatabase() {
  console.log("🔄 Starting database reset...");

  try {
    const tables = await resolveTruncateTables();
    const skipped = TIER_2B_RETIRED_TABLES.filter((t) => !tables.includes(t));
    if (skipped.length > 0) {
      console.log(`  Skipping Tier 2B-retired tables (not present): ${skipped.join(", ")}`);
    }

    const quoted = tables.map((t) => `"${t}"`).join(", ");
    console.log("  Truncating tables (CASCADE)...");
    await db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`));

    console.log("✅ Database reset complete!");
    console.log("📝 All sample data has been removed.");
    console.log("👤 User accounts have been preserved.");
    console.log("");
    console.log("Next steps:");
    console.log("1. Add your sites/locations");
    console.log("2. Create asset categories");
    console.log("3. Start adding your actual assets");

    await client.end({ timeout: 5 });
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    process.exit(1);
  }
}

resetDatabase();
