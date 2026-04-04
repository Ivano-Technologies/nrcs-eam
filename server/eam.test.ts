import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(role: "admin" | "manager" | "technician" | "user" = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@nrcs.org",
    name: "Test User",
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

describe("Dashboard Stats", () => {
  it("should return dashboard statistics", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.dashboard.stats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalAssets).toBe("number");
    expect(typeof stats.operationalAssets).toBe("number");
    expect(typeof stats.maintenanceAssets).toBe("number");
    expect(typeof stats.pendingWorkOrders).toBe("number");
    expect(typeof stats.inProgressWorkOrders).toBe("number");
    expect(typeof stats.lowStockItems).toBe("number");
  });
});

describe("Sites Management", () => {
  it("should list all sites", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const sites = await caller.sites.list();

    expect(Array.isArray(sites)).toBe(true);
    // After seeding, we should have at least 3 sites
    expect(sites.length).toBeGreaterThanOrEqual(3);
  });

  it("should create a new site", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const newSite = await caller.sites.create({
      name: "Test Site",
      address: "123 Test Street",
      city: "Test City",
      state: "Test State",
      country: "Nigeria",
    });

    expect(newSite).toBeDefined();
    expect(newSite.id).toBeGreaterThan(0);
  });
});

describe("Asset Categories", () => {
  it("should list all asset categories", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const categories = await caller.assetCategories.list();

    expect(Array.isArray(categories)).toBe(true);
    // After seeding, we should have at least 7 categories
    expect(categories.length).toBeGreaterThanOrEqual(7);
  });
});

describe("Assets Management", () => {
  it("should list assets with optional filters", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const assets = await caller.assets.list({});

    expect(Array.isArray(assets)).toBe(true);
  });

  it("should create a new asset", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    // Get first site and category for testing
    const sites = await caller.sites.list();
    const categories = await caller.assetCategories.list();

    if (sites.length === 0 || categories.length === 0) {
      throw new Error("No sites or categories available for testing");
    }

    const newAsset = await caller.assets.create({
      assetTag: `TEST-${Date.now()}`,
      name: "Test Asset",
      description: "Test asset for unit testing",
      categoryId: categories[0]!.id,
      siteId: sites[0]!.id,
      manufacturer: "Test Manufacturer",
      model: "Test Model",
    });

    expect(newAsset).toBeDefined();
    expect(newAsset.id).toBeGreaterThan(0);
  });
});

describe("Work Orders Management", () => {
  it("should list work orders", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const workOrders = await caller.workOrders.list({});

    expect(Array.isArray(workOrders)).toBe(true);
  });
});

describe("User Management", () => {
  it("should list users for admin", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const users = await caller.users.list();

    expect(Array.isArray(users)).toBe(true);
  });

  it("should deny user list access to non-admin", async () => {
    const ctx = createTestContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.users.list()).rejects.toThrow();
  });
});

describe("Inventory Management", () => {
  it("should list inventory items", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const items = await caller.inventory.list();

    expect(Array.isArray(items)).toBe(true);
  });

  it("should list low stock items", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const lowStock = await caller.inventory.lowStock();

    expect(Array.isArray(lowStock)).toBe(true);
  });
});

describe("Vendors Management", () => {
  it("should list vendors", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const vendors = await caller.vendors.list();

    expect(Array.isArray(vendors)).toBe(true);
  });
});

describe("Maintenance Schedules", () => {
  it("should list maintenance schedules", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const schedules = await caller.maintenance.list();

    expect(Array.isArray(schedules)).toBe(true);
  });

  it("should list upcoming maintenance", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const upcoming = await caller.maintenance.upcoming({ days: 30 });

    expect(Array.isArray(upcoming)).toBe(true);
  });
});

describe("Financial Tracking", () => {
  it("should list financial transactions", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const transactions = await caller.financial.list();

    expect(Array.isArray(transactions)).toBe(true);
  });
});

describe("Compliance Tracking", () => {
  it("should list compliance records", async () => {
    const ctx = createTestContext("admin");
    const caller = appRouter.createCaller(ctx);

    const records = await caller.compliance.list();

    expect(Array.isArray(records)).toBe(true);
  });
});
