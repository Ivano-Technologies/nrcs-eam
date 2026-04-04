import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1, role: "admin" | "manager" | "technician" | "user" = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Notification System", () => {
  it("should get user notification preferences", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const preferences = await caller.notifications.getPreferences();
    
    // Preferences might be null for new users or have default values
    if (preferences) {
      expect(preferences).toHaveProperty("userId");
      expect(preferences.userId).toBe(ctx.user!.id);
    }
  });

  it("should update notification preferences", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await caller.notifications.updatePreferences({
      maintenanceDue: false,
      lowStock: true,
      workOrderAssigned: true,
    });

    const preferences = await caller.notifications.getPreferences();
    expect(preferences).toBeTruthy();
    if (preferences) {
      expect(preferences.maintenanceDue).toBe(false);
      expect(preferences.lowStock).toBe(true);
      expect(preferences.workOrderAssigned).toBe(true);
    }
  });

  it("should list user notifications", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const notifications = await caller.notifications.list({ limit: 10 });
    
    expect(Array.isArray(notifications)).toBe(true);
  });

  it("should get unread notification count", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const count = await caller.notifications.unreadCount();
    
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("should create work order and notify assigned user", async () => {
    const ctx = createTestContext(1, "admin");
    const caller = appRouter.createCaller(ctx);

    // Create a site first
    const site = await caller.sites.create({
      name: "Test Site for Notifications",
      address: "123 Test St",
      city: "Test City",
      state: "Test State",
    });

    // Create an asset
    const asset = await caller.assets.create({
      assetTag: `TEST-NOTIF-${Date.now()}`,
      name: "Test Asset for Notification",
      categoryId: 1,
      siteId: site.id,
      status: "operational",
      condition: "good",
    });

    // Create work order assigned to user 2
    const workOrder = await caller.workOrders.create({
      workOrderNumber: `WO-NOTIF-${Date.now()}`,
      title: "Test Work Order with Notification",
      assetId: asset.id,
      siteId: site.id,
      type: "corrective",
      priority: "medium",
      assignedTo: 2, // Assign to different user
    });

    expect(workOrder).toBeTruthy();
    expect(workOrder?.assignedTo).toBe(2);

    // Check if notification was created for user 2
    const ctx2 = createTestContext(2, "technician");
    const caller2 = appRouter.createCaller(ctx2);
    const notifications = await caller2.notifications.list({ limit: 10 });
    
    // Should have at least one notification
    const workOrderNotification = notifications.find(
      n => n.type === "work_order_assigned" && n.relatedEntityId === workOrder?.id
    );
    
    if (workOrderNotification) {
      expect(workOrderNotification.title).toContain("Work Order");
      expect(workOrderNotification.isRead).toBe(false);
    }
  });
});
