import * as db from "./db";

/**
 * Helper functions to create notifications for various events
 */

export async function notifyMaintenanceDue(userId: number, assetId: number, assetName: string, dueDate: Date) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.maintenanceDue) return;

  await db.createNotification({
    userId,
    type: "maintenance_due",
    title: "Maintenance Due Soon",
    message: `Maintenance for ${assetName} is due on ${dueDate.toLocaleDateString()}`,
    relatedEntityType: "asset",
    relatedEntityId: assetId,
  });
}

export async function notifyLowStock(userId: number, itemId: number, itemName: string, currentStock: number) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.lowStock) return;

  await db.createNotification({
    userId,
    type: "low_stock",
    title: "Low Stock Alert",
    message: `${itemName} is running low (${currentStock} remaining). Please reorder soon.`,
    relatedEntityType: "inventory",
    relatedEntityId: itemId,
  });
}

export async function notifyWorkOrderAssigned(userId: number, workOrderId: number, workOrderTitle: string) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.workOrderAssigned) return;

  await db.createNotification({
    userId,
    type: "work_order_assigned",
    title: "New Work Order Assigned",
    message: `You have been assigned to work order: ${workOrderTitle}`,
    relatedEntityType: "workOrder",
    relatedEntityId: workOrderId,
  });
}

export async function notifyWorkOrderCompleted(userId: number, workOrderId: number, workOrderTitle: string) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.workOrderCompleted) return;

  await db.createNotification({
    userId,
    type: "work_order_completed",
    title: "Work Order Completed",
    message: `Work order "${workOrderTitle}" has been completed`,
    relatedEntityType: "workOrder",
    relatedEntityId: workOrderId,
  });
}

export async function notifyAssetStatusChange(userId: number, assetId: number, assetName: string, newStatus: string) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.assetStatusChange) return;

  await db.createNotification({
    userId,
    type: "asset_status_change",
    title: "Asset Status Changed",
    message: `${assetName} status changed to: ${newStatus}`,
    relatedEntityType: "asset",
    relatedEntityId: assetId,
  });
}

export async function notifyComplianceDue(userId: number, complianceId: number, complianceType: string, dueDate: Date) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.complianceDue) return;

  await db.createNotification({
    userId,
    type: "compliance_due",
    title: "Compliance Due",
    message: `${complianceType} compliance is due on ${dueDate.toLocaleDateString()}`,
    relatedEntityType: "compliance",
    relatedEntityId: complianceId,
  });
}

export async function notifySystemAlert(userId: number, title: string, message: string) {
  const prefs = await db.getUserNotificationPreferences(userId);
  if (prefs && !prefs.systemAlert) return;

  await db.createNotification({
    userId,
    type: "system_alert",
    title,
    message,
    relatedEntityType: null,
    relatedEntityId: null,
  });
}

/**
 * Check for maintenance due in the next 7 days and notify relevant users
 */
export async function checkAndNotifyUpcomingMaintenance() {
  const upcomingMaintenance = await db.getUpcomingMaintenance(7);
  const users = await db.getAllUsers();
  
  for (const schedule of upcomingMaintenance) {
    if (schedule.assetId && schedule.nextDue) {
      const asset = await db.getAssetById(schedule.assetId);
      if (asset) {
        // Notify all managers and admins
        for (const user of users) {
          if (user.role === "admin" || user.role === "manager") {
            await notifyMaintenanceDue(user.id, asset.id, asset.name, schedule.nextDue);
          }
        }
      }
    }
  }
}

/**
 * Check for low stock items and notify relevant users
 */
export async function checkAndNotifyLowStock() {
  const lowStockItems = await db.getLowStockItems();
  const users = await db.getAllUsers();
  
  for (const item of lowStockItems) {
    // Notify all managers and admins
    for (const user of users) {
      if (user.role === "admin" || user.role === "manager") {
        await notifyLowStock(user.id, item.id, item.name, item.currentStock);
      }
    }
  }
}


/**
 * Send warranty expiration alert email to owner
 */
export async function sendWarrantyExpirationAlert(data: {
  assetId: number;
  assetName: string;
  assetTag: string;
  warrantyExpiry: Date;
  daysUntilExpiry: number;
  manufacturer: string;
  model: string;
}) {
  const { notifyOwner } = await import('./_core/notification');
  
  const urgency = data.daysUntilExpiry <= 30 ? '🔴 URGENT' : data.daysUntilExpiry <= 60 ? '🟡 WARNING' : '🟢 NOTICE';
  
  await notifyOwner({
    title: `${urgency}: Warranty Expiring for ${data.assetName}`,
    content: `
Asset Warranty Expiration Alert

${urgency}

Asset Details:
- Name: ${data.assetName}
- Tag: ${data.assetTag}
- Manufacturer: ${data.manufacturer}
- Model: ${data.model}

Warranty Status:
- Expiry Date: ${new Date(data.warrantyExpiry).toLocaleDateString()}
- Days Until Expiry: ${data.daysUntilExpiry} days
- Status: ${data.daysUntilExpiry < 0 ? 'EXPIRED' : data.daysUntilExpiry <= 30 ? 'CRITICAL' : data.daysUntilExpiry <= 60 ? 'WARNING' : 'UPCOMING'}

Action Required:
${data.daysUntilExpiry < 0 
  ? '⚠️ Warranty has expired. Contact manufacturer for renewal options.'
  : data.daysUntilExpiry <= 30
  ? '⚠️ Warranty expires soon! Contact manufacturer immediately to renew.'
  : '📋 Review warranty terms and prepare for renewal if needed.'
}

---
This is an automated alert from NRCS Enterprise Asset Management System.
    `.trim(),
  });
}
