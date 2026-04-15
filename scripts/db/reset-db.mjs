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

async function resetDatabase() {
  console.log("🔄 Starting database reset...");

  try {
    const tables = [
      "assetPhotos",
      "scheduledReports",
      "notificationPreferences",
      "notifications",
      "documents",
      "auditLogs",
      "complianceRecords",
      "financialTransactions",
      "inventoryTransactions",
      "inventoryItems",
      "vendors",
      "maintenanceSchedules",
      "workOrders",
      "assets",
      "assetCategories",
      "sites",
    ];

    const quoted = tables.map((t) => `"${t}"`).join(", ");
    console.log("  Truncating tables (CASCADE)...");
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`)
    );

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
