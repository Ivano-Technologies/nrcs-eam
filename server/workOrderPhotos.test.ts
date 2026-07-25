import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

const uploadMock = vi.fn();
const removeMock = vi.fn();
const getPublicUrlMock = vi.fn();
const getBucketMock = vi.fn();
const createBucketMock = vi.fn();

vi.mock("./_core/supabase", () => ({
  getSupabaseSecret: () => ({
    storage: {
      getBucket: (...args: unknown[]) => getBucketMock(...args),
      createBucket: (...args: unknown[]) => createBucketMock(...args),
      from: () => ({
        upload: (...args: unknown[]) => uploadMock(...args),
        remove: (...args: unknown[]) => removeMock(...args),
        getPublicUrl: (...args: unknown[]) => getPublicUrlMock(...args),
      }),
    },
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

async function ensureTestUser(
  role: "admin" | "manager" | "staff" | "user",
  siteId: number | null = null,
): Promise<AuthenticatedUser> {
  const openId = `wo-photo-test-${role}`;
  await db.upsertUser({
    openId,
    name: `WO Photo ${role}`,
    email: `wo-photo-${role}@nrcs.org`,
    loginMethod: "test",
    role,
    siteId: siteId ?? undefined,
    lastSignedIn: new Date(),
  });
  const upserted = await db.getUserByOpenId(openId);
  if (!upserted?.id) {
    throw new Error(`Failed to upsert test user for role ${role}`);
  }
  return {
    id: upserted.id,
    openId,
    authUserId: null,
    email: upserted.email ?? `wo-photo-${role}@nrcs.org`,
    name: upserted.name ?? `WO Photo ${role}`,
    loginMethod: "test",
    role,
    siteId,
    hasCompletedOnboarding: true,
    createdAt: upserted.createdAt,
    updatedAt: upserted.updatedAt,
    lastSignedIn: upserted.lastSignedIn,
  };
}

async function createTestContext(
  role: "admin" | "manager" | "staff" | "user" = "admin",
  siteId: number | null = null,
): Promise<TrpcContext> {
  const user = await ensureTestUser(role, siteId);
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

/** 1x1 JPEG */
const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z";

async function createWorkOrderFixture() {
  const admin = appRouter.createCaller(await createTestContext("admin"));
  const categories = await admin.assetCategories.list();
  const sites = await admin.sites.list();
  const site = sites[0];
  if (!site || categories.length === 0) {
    throw new Error("Seed data missing sites/categories");
  }

  const asset = await admin.assets.create({
    assetTag: `WO-PHOTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: "Photo test asset",
    categoryId: categories[0]!.id,
    siteId: site.id,
    itemType: "Asset",
    itemCategory: "Office Equipment",
    itemCategoryCode: "OE",
  });

  const wo = await admin.workOrders.create({
    workOrderNumber: `WO-PHOTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: "Photo capture test",
    assetId: asset.id,
    siteId: site.id,
    type: "corrective",
    priority: "medium",
  });

  if (!wo?.id) throw new Error("Failed to create work order");
  return {
    workOrderId: wo.id,
    siteId: site.id,
    otherSiteId: sites.find((s) => s.id !== site.id)?.id,
  };
}

describe("workOrders.photos", () => {
  beforeEach(() => {
    getBucketMock.mockResolvedValue({ data: { name: "work-order-photos" }, error: null });
    createBucketMock.mockResolvedValue({ error: null });
    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockImplementation((key: string) => ({
      data: { publicUrl: `https://example.test/storage/${key}` },
    }));
  });

  it("rejects staff scoped to a different facility", async () => {
    const { workOrderId, siteId, otherSiteId } = await createWorkOrderFixture();
    const foreignSiteId = otherSiteId ?? siteId + 999;
    const staffCaller = appRouter.createCaller(
      await createTestContext("staff", foreignSiteId),
    );

    await expect(
      staffCaller.workOrders.photos.upload({
        workOrderId,
        data: TINY_JPEG_BASE64,
        mimeType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      staffCaller.workOrders.photos.list({ workOrderId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  }, 30000);

  it("rejects unsupported mime types", async () => {
    const admin = appRouter.createCaller(await createTestContext("admin"));
    const { workOrderId } = await createWorkOrderFixture();

    await expect(
      admin.workOrders.photos.upload({
        workOrderId,
        data: TINY_JPEG_BASE64,
        // @ts-expect-error intentional invalid mime for runtime zod rejection
        mimeType: "image/gif",
      }),
    ).rejects.toThrow();
  }, 30000);

  it("lists photos newest first", async () => {
    const admin = appRouter.createCaller(await createTestContext("admin"));
    const { workOrderId } = await createWorkOrderFixture();

    const first = await admin.workOrders.photos.upload({
      workOrderId,
      data: TINY_JPEG_BASE64,
      mimeType: "image/jpeg",
      caption: "first",
    });
    await new Promise((r) => setTimeout(r, 20));
    const second = await admin.workOrders.photos.upload({
      workOrderId,
      data: TINY_JPEG_BASE64,
      mimeType: "image/jpeg",
      caption: "second",
    });

    const listed = await admin.workOrders.photos.list({ workOrderId });
    expect(listed.length).toBeGreaterThanOrEqual(2);
    expect(listed[0]!.id).toBe(second.id);
    expect(listed.some((p) => p.id === first.id)).toBe(true);
    expect(listed[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(
      listed[1]!.createdAt.getTime(),
    );
  }, 30000);
});
