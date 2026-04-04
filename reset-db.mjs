#!/usr/bin/env node
/**
 * Database Reset Script
 * Clears all sample data from tables while preserving schema
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function resetDatabase() {
  console.log('🔄 Starting database reset...');
  
  try {
    // Disable foreign key checks temporarily
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    
    // Clear all tables (except users table to preserve admin access)
    const tables = [
      'assetPhotos',
      'scheduledReports',
      'notificationPreferences',
      'notifications',
      'documents',
      'auditLogs',
      'complianceRecords',
      'financialTransactions',
      'inventoryTransactions',
      'inventoryItems',
      'vendors',
      'maintenanceSchedules',
      'workOrders',
      'assets',
      'assetCategories',
      'sites',
    ];
    
    for (const table of tables) {
      console.log(`  Clearing ${table}...`);
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    
    // Reset auto-increment counters
    for (const table of tables) {
      await db.execute(sql.raw(`ALTER TABLE ${table} AUTO_INCREMENT = 1`));
    }
    
    // Re-enable foreign key checks
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    
    console.log('✅ Database reset complete!');
    console.log('📝 All sample data has been removed.');
    console.log('👤 User accounts have been preserved.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Add your sites/locations');
    console.log('2. Create asset categories');
    console.log('3. Start adding your actual assets');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
