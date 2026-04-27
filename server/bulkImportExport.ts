import ExcelJS from 'exceljs';
import * as db from './db';
import { generateNRCSAssetRegisterTemplateBuffer } from './nrcsAssetExcel';

/**
 * Bulk Import/Export System for Assets and other entities
 */

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

export interface ExportOptions {
  format: 'excel' | 'csv';
  includeHeaders: boolean;
}

/**
 * Export assets to Excel/CSV
 */
export async function exportAssets(options: ExportOptions = { format: 'excel', includeHeaders: true }): Promise<Buffer> {
  const assets = await db.getAllAssets();
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Assets');
  
  // Define columns
  worksheet.columns = [
    { header: 'Asset Tag', key: 'assetTag', width: 15 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Category ID', key: 'categoryId', width: 12 },
    { header: 'Site ID', key: 'siteId', width: 10 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Manufacturer', key: 'manufacturer', width: 20 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Serial Number', key: 'serialNumber', width: 20 },
    { header: 'Acquisition Date', key: 'acquisitionDate', width: 15 },
    { header: 'Acquisition Cost', key: 'acquisitionCost', width: 15 },
    { header: 'Current Value', key: 'currentValue', width: 15 },
    { header: 'Depreciation Rate', key: 'depreciationRate', width: 15 },
    { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 15 },
    { header: 'Location', key: 'location', width: 25 },
    { header: 'Notes', key: 'notes', width: 40 },
  ];
  
  // Add data
  assets.forEach(asset => {
    worksheet.addRow({
      assetTag: asset.assetTag,
      name: asset.name,
      description: asset.description,
      categoryId: asset.categoryId,
      siteId: asset.siteId,
      status: asset.status,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serialNumber: asset.serialNumber,
      acquisitionDate: asset.acquisitionDate ? new Date(asset.acquisitionDate).toISOString().split('T')[0] : '',
      acquisitionCost: asset.acquisitionCost,
      currentValue: asset.currentValue,
      depreciationRate: asset.depreciationRate,
      warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : '',
      location: asset.location,
      notes: asset.notes,
    });
  });
  
  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' }, // Navy blue
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Import assets from Excel/CSV
 */
export async function importAssets(fileBuffer: any, userId: number): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  
  const worksheet = workbook.getWorksheet('Assets') || workbook.worksheets[0];
  if (!worksheet) {
    return {
      success: false,
      imported: 0,
      failed: 0,
      errors: [{ row: 0, error: 'No worksheet found', data: null }],
    };
  }
  
  let imported = 0;
  let failed = 0;
  const errors: Array<{ row: number; error: string; data: any }> = [];
  
  // Process rows sequentially
  const rows: any[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1) { // Skip header
      rows.push({ row, rowNumber });
    }
  });
  
  for (const { row, rowNumber } of rows) {
    try {
      const assetData = {
        assetTag: row.getCell(1).value?.toString() || '',
        name: row.getCell(2).value?.toString() || '',
        description: row.getCell(3).value?.toString(),
        categoryId: parseInt(row.getCell(4).value?.toString() || '0'),
        siteId: parseInt(row.getCell(5).value?.toString() || '0'),
        status: row.getCell(6).value?.toString() as any || 'operational',
        manufacturer: row.getCell(7).value?.toString(),
        model: row.getCell(8).value?.toString(),
        serialNumber: row.getCell(9).value?.toString(),
        acquisitionDate: row.getCell(10).value ? new Date(row.getCell(10).value?.toString() || '') : undefined,
        acquisitionCost: row.getCell(11).value?.toString(),
        currentValue: row.getCell(12).value?.toString(),
        depreciationRate: row.getCell(13).value?.toString(),
        warrantyExpiry: row.getCell(14).value ? new Date(row.getCell(14).value?.toString() || '') : undefined,
        location: row.getCell(15).value?.toString(),
        notes: row.getCell(16).value?.toString(),
      };
      
      // Validate required fields
      if (!assetData.assetTag || !assetData.name) {
        throw new Error('Asset Tag and Name are required');
      }
      
      // Check for duplicate asset tag
      const existing = await db.getAssetByTag(assetData.assetTag);
      if (existing) {
        throw new Error(`Asset with tag ${assetData.assetTag} already exists`);
      }
      
      await db.createAsset(assetData);
      imported++;
      
    } catch (error: any) {
      failed++;
      errors.push({
        row: rowNumber,
        error: error.message || 'Unknown error',
        data: row.values,
      });
    }
  }
  
  return {
    success: failed === 0,
    imported,
    failed,
    errors,
  };
}

/**
 * Export work orders
 */
export async function exportWorkOrders(): Promise<Buffer> {
  const workOrders = await db.getAllWorkOrders();
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Work Orders');
  
  worksheet.columns = [
    { header: 'Work Order Number', key: 'workOrderNumber', width: 20 },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Asset ID', key: 'assetId', width: 12 },
    { header: 'Site ID', key: 'siteId', width: 10 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Assigned To', key: 'assignedTo', width: 12 },
    { header: 'Scheduled Start', key: 'scheduledStart', width: 15 },
    { header: 'Scheduled End', key: 'scheduledEnd', width: 15 },
    { header: 'Estimated Cost', key: 'estimatedCost', width: 15 },
    { header: 'Actual Cost', key: 'actualCost', width: 15 },
  ];
  
  workOrders.forEach(wo => {
    worksheet.addRow({
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      assetId: wo.assetId,
      siteId: wo.siteId,
      type: wo.type,
      priority: wo.priority,
      status: wo.status,
      assignedTo: wo.assignedTo,
      scheduledStart: wo.scheduledStart ? new Date(wo.scheduledStart).toISOString().split('T')[0] : '',
      scheduledEnd: wo.scheduledEnd ? new Date(wo.scheduledEnd).toISOString().split('T')[0] : '',
      estimatedCost: wo.estimatedCost,
      actualCost: wo.actualCost,
    });
  });
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export inventory items
 */
export async function exportInventory(): Promise<Buffer> {
  const items = await db.getAllInventoryItems();
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inventory');
  
  worksheet.columns = [
    { header: 'Item Code', key: 'itemCode', width: 15 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Current Stock', key: 'currentStock', width: 15 },
    { header: 'Minimum Stock', key: 'minimumStock', width: 15 },
    { header: 'Reorder Point', key: 'reorderPoint', width: 15 },
    { header: 'Unit Price', key: 'unitPrice', width: 15 },
    { header: 'Location', key: 'location', width: 25 },
  ];
  
  items.forEach(item => {
    worksheet.addRow({
      itemCode: item.itemCode,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      minimumStock: item.minStockLevel,
      reorderPoint: item.reorderPoint,
      unitPrice: 0, // Not in schema
      location: item.location,
    });
  });
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate import template
 */
export async function generateImportTemplate(entity: 'assets' | 'workOrders' | 'inventory'): Promise<Buffer> {
  if (entity === "assets") {
    return await generateNRCSAssetRegisterTemplateBuffer();
  }
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet(entity);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}


/**
 * Export facilities (`sites` table) to Excel
 */
export async function exportSites(): Promise<Buffer> {
  const sites = await db.getAllSites();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Facilities");

  worksheet.columns = [
    { header: "Code", key: "code", width: 18 },
    { header: "Facility name", key: "name", width: 30 },
    { header: "Address", key: "address", width: 40 },
    { header: "City", key: "city", width: 20 },
    { header: "State", key: "state", width: 20 },
    { header: "Postal code", key: "postalCode", width: 16 },
    { header: "Country", key: "country", width: 20 },
    { header: "Contact person", key: "contactPerson", width: 25 },
    { header: "Contact phone", key: "contactPhone", width: 20 },
    { header: "Contact email", key: "contactEmail", width: 30 },
    { header: "Status", key: "status", width: 12 },
    { header: "Latitude", key: "latitude", width: 15 },
    { header: "Longitude", key: "longitude", width: 15 },
    { header: "Facility type", key: "facilityType", width: 18 },
    { header: "Parent facility ID", key: "parentFacilityId", width: 18 },
  ];

  sites.forEach((site) => {
    worksheet.addRow({
      code: site.code,
      name: site.name,
      address: site.address,
      city: site.city,
      state: site.state,
      postalCode: site.postalCode,
      country: site.country,
      contactPerson: site.contactPerson,
      contactPhone: site.contactPhone,
      contactEmail: site.contactEmail,
      status: site.isActive ? "Active" : "Inactive",
      latitude: site.latitude,
      longitude: site.longitude,
      facilityType: site.facilityType,
      parentFacilityId: site.parentFacilityId,
    });
  });
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Import facilities from Excel (`sites` table)
 */
export async function importSites(fileBuffer: any): Promise<ImportResult> {
  const { FACILITY_TYPE_VALUES } = await import("../shared/facilities");
  const isFacilityType = (v: string): v is (typeof FACILITY_TYPE_VALUES)[number] =>
    (FACILITY_TYPE_VALUES as readonly string[]).includes(v);
  const normaliseFacilityType = (value: string | undefined): string =>
    (value ?? "").toLowerCase().trim().replace(/\s+/g, "_");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheet =
    workbook.getWorksheet("Facilities") ||
    workbook.getWorksheet("Sites") ||
    workbook.worksheets[0];
  if (!worksheet) {
    return {
      success: false,
      imported: 0,
      failed: 0,
      errors: [{ row: 0, error: 'No worksheet found', data: null }],
    };
  }
  
  let imported = 0;
  let failed = 0;
  const errors: Array<{ row: number; error: string; data: any }> = [];
  
  const rows: any[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    rows.push({ row, rowNumber });
  });
  
  for (const { row, rowNumber } of rows) {
    try {
      const typeCell = normaliseFacilityType(row.getCell(14).value?.toString());
      const parentCell = row.getCell(15).value;
      let parentFacilityId: number | null = null;
      if (parentCell !== null && parentCell !== undefined && String(parentCell).trim() !== "") {
        const n = Number.parseInt(String(parentCell), 10);
        if (Number.isFinite(n)) parentFacilityId = n;
      }

      const facilityType =
        typeCell && isFacilityType(typeCell) ? typeCell : "branch";

      const siteData = {
        code: row.getCell(1).value?.toString()?.trim() || undefined,
        name: row.getCell(2).value?.toString() || "",
        address: row.getCell(3).value?.toString(),
        city: row.getCell(4).value?.toString(),
        state: row.getCell(5).value?.toString(),
        postalCode: row.getCell(6).value?.toString(),
        country: row.getCell(7).value?.toString() || "Nigeria",
        contactPerson: row.getCell(8).value?.toString(),
        contactPhone: row.getCell(9).value?.toString(),
        contactEmail: row.getCell(10).value?.toString(),
        isActive: (row.getCell(11).value?.toString() || "").toLowerCase() !== "inactive",
        latitude: row.getCell(12).value ? row.getCell(12).value.toString() : undefined,
        longitude: row.getCell(13).value ? row.getCell(13).value.toString() : undefined,
        facilityType,
        parentFacilityId,
      };

      if (!siteData.name) {
        throw new Error("Facility name is required");
      }

      if (siteData.facilityType === "clinic" || siteData.facilityType === "warehouse") {
        if (siteData.parentFacilityId == null) {
          throw new Error("Parent facility ID is required for clinic and warehouse rows");
        }
        const p = await db.getSiteById(siteData.parentFacilityId);
        if (!p || p.facilityType !== "branch") {
          throw new Error("Parent must be an existing branch facility");
        }
      }

      await db.createSite(siteData);
      imported++;
      
    } catch (error: any) {
      failed++;
      errors.push({
        row: rowNumber,
        error: error.message || 'Unknown error',
        data: row.values,
      });
    }
  }
  
  return {
    success: failed === 0,
    imported,
    failed,
    errors,
  };
}

/**
 * Generate facility import template
 */
export async function generateSiteTemplate(): Promise<Buffer> {
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
    { header: "Parent facility ID (required for clinic/warehouse)", key: "parentFacilityId", width: 36 },
  ];
  
  // Add sample rows
  worksheet.addRow({
    code: "FCT-BRN-001",
    name: "NRCS Abuja Headquarters",
    postalCode: "900001",
    address: "National Headquarters, Red Cross Road",
    city: "Abuja",
    state: "FCT",
    country: "Nigeria",
    contactPerson: "John Doe",
    contactPhone: "+234-xxx-xxx-xxxx",
    contactEmail: "abuja@redcross.org.ng",
    status: "Active",
    latitude: "9.0579",
    longitude: "7.4951",
    facilityType: "branch",
    parentFacilityId: "",
  });

  worksheet.addRow({
    code: "LAG-BRN-001",
    name: "NRCS Lagos State Branch",
    postalCode: "100001",
    address: "123 Marina Street",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    contactPerson: "Jane Smith",
    contactPhone: "+234-xxx-xxx-xxxx",
    contactEmail: "lagos@redcross.org.ng",
    status: "Active",
    latitude: "6.5244",
    longitude: "3.3792",
    facilityType: "branch",
    parentFacilityId: "",
  });
  
  // Style header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  
  // Add instructions
  worksheet.addRow([]);
  worksheet.addRow(["Instructions:"]);
  worksheet.addRow(["1. Fill in the facility information in the rows above"]);
  worksheet.addRow(["2. Fields marked with * are required"]);
  worksheet.addRow(["3. Delete the sample rows before uploading"]);
  worksheet.addRow(["4. Latitude and longitude are optional but recommended for map features"]);
  worksheet.addRow([
    "5. Facility type defaults to branch; valid types: branch, division, clinic, warehouse, national_headquarters",
  ]);
  worksheet.addRow(["6. Save the file and upload it through the Facilities page"]);
  
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
