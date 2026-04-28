import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import ExcelJS from "exceljs";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    authUserId: null,
    name: "Test Admin",
    email: "admin@test.com",
    loginMethod: "supabase",
    role: "admin",
    siteId: null,
    hasCompletedOnboarding: true,
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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Bulk facility import", () => {
  it("should generate facility import template", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.bulkOperations.downloadSiteTemplate();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.filename).toBe("NRCS_Facilities_Import_Template.xlsx");
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const buffer = Buffer.from(result.data, "base64");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet("Facilities");
    expect(worksheet).toBeDefined();

    const headerRow = worksheet?.getRow(1);
    expect(headerRow?.getCell(1).value).toBe("Code");
    expect(headerRow?.getCell(2).value).toBe("Facility name*");
    expect(headerRow?.getCell(3).value).toBe("Address");
    expect(headerRow?.getCell(4).value).toBe("City");
    expect(headerRow?.getCell(10).value).toBe("Contact email");
  });

  it("should import facilities from Excel file", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const seed = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code1 = `T1${seed}`;
    const code2 = `T2${seed}`;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Facilities");

    worksheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Facility name*", key: "name", width: 30 },
      { header: "Address", key: "address", width: 40 },
      { header: "City", key: "city", width: 20 },
      { header: "State", key: "state", width: 20 },
      { header: "Postal code", key: "postalCode", width: 16 },
      { header: "Country", key: "country", width: 20 },
      { header: "Contact person", key: "contactPerson", width: 25 },
      { header: "Contact phone", key: "contactPhone", width: 20 },
      { header: "Contact email", key: "contactEmail", width: 30 },
      { header: "Status (Active/Inactive)", key: "status", width: 20 },
      { header: "Latitude", key: "latitude", width: 15 },
      { header: "Longitude", key: "longitude", width: 15 },
      { header: "Facility type (branch|division|clinic|warehouse|national_headquarters)", key: "facilityType", width: 48 },
      { header: "Parent facility code (optional)", key: "parentFacilityCode", width: 36 },
    ];

    worksheet.addRow({
      code: code1,
      name: `Test Facility Alpha ${seed}`,
      postalCode: "100001",
      address: "123 Test Street",
      city: "Test City",
      state: "Test State",
      country: "Nigeria",
      contactPerson: "Test Contact",
      contactPhone: "+234-123-456-7890",
      contactEmail: "test@example.com",
      status: "Active",
      latitude: "9.0579",
      longitude: "7.4951",
      facilityType: "National Headquarters",
      parentFacilityCode: "",
    });

    worksheet.addRow({
      code: code2,
      name: `Test Facility Beta ${seed}`,
      postalCode: "100002",
      address: "456 Demo Avenue",
      city: "Demo City",
      state: "Demo State",
      country: "Nigeria",
      contactPerson: "Demo Contact",
      contactPhone: "+234-987-654-3210",
      contactEmail: "demo@example.com",
      status: "Active",
      latitude: "6.5244",
      longitude: "3.3792",
      facilityType: "branch",
      parentFacilityCode: "",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    const result = await caller.bulkOperations.importSites({
      fileData: base64Data,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.imported).toBeGreaterThanOrEqual(2);
    expect(result.failed).toBe(0);
  }, 15000);

  it("should handle invalid data gracefully", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Facilities");

    worksheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Facility name*", key: "name", width: 30 },
      { header: "Address", key: "address", width: 40 },
      { header: "City", key: "city", width: 20 },
      { header: "State", key: "state", width: 20 },
      { header: "Postal code", key: "postalCode", width: 16 },
      { header: "Country", key: "country", width: 20 },
      { header: "Contact person", key: "contactPerson", width: 25 },
      { header: "Contact phone", key: "contactPhone", width: 20 },
      { header: "Contact email", key: "contactEmail", width: 30 },
      { header: "Status (Active/Inactive)", key: "status", width: 20 },
      { header: "Latitude", key: "latitude", width: 15 },
      { header: "Longitude", key: "longitude", width: 15 },
      { header: "Facility type (branch|division|clinic|warehouse|national_headquarters)", key: "facilityType", width: 48 },
      { header: "Parent facility code (optional)", key: "parentFacilityCode", width: 36 },
    ];

    worksheet.addRow({
      name: "",
      address: "789 Invalid Street",
      city: "Invalid City",
      state: "Invalid State",
      facilityType: "branch",
      parentFacilityCode: "",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    const result = await caller.bulkOperations.importSites({
      fileData: base64Data,
    });

    expect(result).toBeDefined();
    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should set parentFacilityId when parent code exists", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const seed = Math.random().toString(36).substring(2, 6).toUpperCase();
    const parentCode = `P${seed}`;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Facilities");
    worksheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Facility name*", key: "name", width: 30 },
      { header: "Address", key: "address", width: 40 },
      { header: "City", key: "city", width: 20 },
      { header: "State", key: "state", width: 20 },
      { header: "Postal code", key: "postalCode", width: 16 },
      { header: "Country", key: "country", width: 20 },
      { header: "Contact person", key: "contactPerson", width: 25 },
      { header: "Contact phone", key: "contactPhone", width: 20 },
      { header: "Contact email", key: "contactEmail", width: 30 },
      { header: "Status (Active/Inactive)", key: "status", width: 20 },
      { header: "Latitude", key: "latitude", width: 15 },
      { header: "Longitude", key: "longitude", width: 15 },
      { header: "Facility type (branch|division|clinic|warehouse|national_headquarters)", key: "facilityType", width: 48 },
      { header: "Parent facility code (optional)", key: "parentFacilityCode", width: 36 },
    ];

    worksheet.addRow({
      code: parentCode,
      name: `Parent Branch ${seed}`,
      facilityType: "branch",
      parentFacilityCode: "",
    });
    worksheet.addRow({
      code: `C${seed}`,
      name: `Child Clinic ${seed}`,
      facilityType: "clinic",
      parentFacilityCode: parentCode,
    });

    const base64Data = Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
    const result = await caller.bulkOperations.importSites({ fileData: base64Data });
    expect(result.imported).toBeGreaterThanOrEqual(2);
    expect(result.failed).toBe(0);
    expect(result.warnings ?? []).toHaveLength(1);
    expect(result.warnings?.[0]?.warning.toLowerCase()).toContain("parent");

    const created = await caller.sites.list();
    const parent = created.find((s) => s.code === parentCode);
    const child = created.find((s) => s.code === `C${seed}`);
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(child?.parentFacilityId).toBeNull();
  }, 15000);

  it("should import row and warn when parent code is unknown", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const seed = Math.random().toString(36).substring(2, 6).toUpperCase();
    const unknownParentCode = `UNKNOWN-${seed}`;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Facilities");
    worksheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Facility name*", key: "name", width: 30 },
      { header: "Address", key: "address", width: 40 },
      { header: "City", key: "city", width: 20 },
      { header: "State", key: "state", width: 20 },
      { header: "Postal code", key: "postalCode", width: 16 },
      { header: "Country", key: "country", width: 20 },
      { header: "Contact person", key: "contactPerson", width: 25 },
      { header: "Contact phone", key: "contactPhone", width: 20 },
      { header: "Contact email", key: "contactEmail", width: 30 },
      { header: "Status (Active/Inactive)", key: "status", width: 20 },
      { header: "Latitude", key: "latitude", width: 15 },
      { header: "Longitude", key: "longitude", width: 15 },
      { header: "Facility type (branch|division|clinic|warehouse|national_headquarters)", key: "facilityType", width: 48 },
      { header: "Parent facility code (optional)", key: "parentFacilityCode", width: 36 },
    ];

    worksheet.addRow({
      code: `U${seed}`,
      name: `Unknown Parent Clinic ${seed}`,
      facilityType: "clinic",
      parentFacilityCode: unknownParentCode,
    });

    const base64Data = Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
    const result = await caller.bulkOperations.importSites({ fileData: base64Data });
    expect(result.failed).toBe(0);
    expect(result.imported).toBeGreaterThanOrEqual(1);
    expect(result.warnings?.some((w) => String(w.warning).includes(unknownParentCode))).toBe(true);

    const created = await caller.sites.list();
    const child = created.find((s) => s.code === `U${seed}`);
    expect(child).toBeDefined();
    expect(child?.parentFacilityId).toBeNull();
  }, 15000);

  it("should import row cleanly when parent code is empty", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const seed = Math.random().toString(36).substring(2, 6).toUpperCase();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Facilities");
    worksheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Facility name*", key: "name", width: 30 },
      { header: "Address", key: "address", width: 40 },
      { header: "City", key: "city", width: 20 },
      { header: "State", key: "state", width: 20 },
      { header: "Postal code", key: "postalCode", width: 16 },
      { header: "Country", key: "country", width: 20 },
      { header: "Contact person", key: "contactPerson", width: 25 },
      { header: "Contact phone", key: "contactPhone", width: 20 },
      { header: "Contact email", key: "contactEmail", width: 30 },
      { header: "Status (Active/Inactive)", key: "status", width: 20 },
      { header: "Latitude", key: "latitude", width: 15 },
      { header: "Longitude", key: "longitude", width: 15 },
      { header: "Facility type (branch|division|clinic|warehouse|national_headquarters)", key: "facilityType", width: 48 },
      { header: "Parent facility code (optional)", key: "parentFacilityCode", width: 36 },
    ];

    worksheet.addRow({
      code: `E${seed}`,
      name: `Empty Parent Warehouse ${seed}`,
      facilityType: "warehouse",
      parentFacilityCode: "",
    });

    const base64Data = Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
    const result = await caller.bulkOperations.importSites({ fileData: base64Data });
    expect(result.failed).toBe(0);
    expect(result.imported).toBeGreaterThanOrEqual(1);
    expect(result.warnings ?? []).toEqual([]);

    const created = await caller.sites.list();
    const row = created.find((s) => s.code === `E${seed}`);
    expect(row).toBeDefined();
    expect(row?.parentFacilityId).toBeNull();
  }, 15000);

  it("should export existing facilities to Excel", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.bulkOperations.exportSites();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.filename).toContain("facilities_export_");
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const buffer = Buffer.from(result.data, "base64");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet("Facilities");
    expect(worksheet).toBeDefined();

    const headerRow = worksheet?.getRow(1);
    expect(headerRow?.getCell(1).value).toBe("Code");
  }, 15000);
});
