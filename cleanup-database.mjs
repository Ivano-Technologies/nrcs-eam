import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.data', 'sqlite.db');
const db = new Database(dbPath);

console.log('🗑️  Starting database cleanup...\n');

try {
  // Start transaction
  db.exec('BEGIN TRANSACTION');

  // Delete all data from tables (in correct order to respect foreign keys)
  const tables = [
    'asset_transfers',
    'asset_lifecycle_costs',
    'predictive_maintenance',
    'notifications',
    'notification_preferences',
    'compliance_reports',
    'financial_transactions',
    'quickbooks_config',
    'report_schedules',
    'work_order_photos',
    'work_orders',
    'maintenance_schedules',
    'inventory_items',
    'vendors',
    'assets',
    'asset_categories',
    'sites',
  ];

  let totalDeleted = 0;
  
  for (const table of tables) {
    try {
      const result = db.prepare(`DELETE FROM ${table}`).run();
      console.log(`✓ Cleared ${table}: ${result.changes} rows deleted`);
      totalDeleted += result.changes;
    } catch (error) {
      console.log(`⚠ Skipped ${table}: ${error.message}`);
    }
  }

  // Commit transaction
  db.exec('COMMIT');
  
  console.log(`\n✅ Database cleanup complete!`);
  console.log(`📊 Total rows deleted: ${totalDeleted}`);
  console.log(`\n⚠️  Note: User accounts were preserved for authentication.`);
  
} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Error during cleanup:', error.message);
  process.exit(1);
} finally {
  db.close();
}
