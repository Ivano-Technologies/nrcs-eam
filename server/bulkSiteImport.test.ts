import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import ExcelJS from 'exceljs';
import type { TrpcContext } from './_core/context';

type AuthenticatedUser = NonNullable<TrpcContext['user']>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: 'test-admin',
    name: 'Test Admin',
    email: 'admin@test.com',
    loginMethod: 'manus',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {
      clearCookie: () => {},
    } as TrpcContext['res'],
  };
}

describe('Bulk Site Import', () => {
  it('should generate site import template', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.bulkOperations.downloadSiteTemplate();
    
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.filename).toBe('NRCS_Sites_Import_Template.xlsx');
    expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Verify template can be parsed
    const buffer = Buffer.from(result.data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.getWorksheet('Sites');
    expect(worksheet).toBeDefined();
    
    // Check headers
    const headerRow = worksheet?.getRow(1);
    expect(headerRow?.getCell(1).value).toBe('Site Name*');
    expect(headerRow?.getCell(2).value).toBe('Address');
    expect(headerRow?.getCell(3).value).toBe('City');
    expect(headerRow?.getCell(4).value).toBe('State');
    expect(headerRow?.getCell(8).value).toBe('Contact Email');
  });

  it('should import sites from Excel file', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    // Create a test Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sites');
    
    worksheet.columns = [
      { header: 'Site Name*', key: 'name', width: 30 },
      { header: 'Address', key: 'address', width: 40 },
      { header: 'City', key: 'city', width: 20 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'Country', key: 'country', width: 20 },
      { header: 'Contact Person', key: 'contactPerson', width: 25 },
      { header: 'Contact Phone', key: 'contactPhone', width: 20 },
      { header: 'Contact Email', key: 'contactEmail', width: 30 },
      { header: 'Latitude', key: 'latitude', width: 15 },
      { header: 'Longitude', key: 'longitude', width: 15 },
    ];
    
    // Add test data
    worksheet.addRow({
      name: 'Test Site Alpha',
      address: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      country: 'Nigeria',
      contactPerson: 'Test Contact',
      contactPhone: '+234-123-456-7890',
      contactEmail: 'test@example.com',
      latitude: '9.0579',
      longitude: '7.4951',
    });
    
    worksheet.addRow({
      name: 'Test Site Beta',
      address: '456 Demo Avenue',
      city: 'Demo City',
      state: 'Demo State',
      country: 'Nigeria',
      contactPerson: 'Demo Contact',
      contactPhone: '+234-987-654-3210',
      contactEmail: 'demo@example.com',
      latitude: '6.5244',
      longitude: '3.3792',
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    
    // Import the file
    const result = await caller.bulkOperations.importSites({
      fileData: base64Data,
    });
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.imported).toBeGreaterThanOrEqual(2);
    expect(result.failed).toBe(0);
  });

  it('should handle invalid data gracefully', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    // Create a test Excel file with invalid data
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sites');
    
    worksheet.columns = [
      { header: 'Site Name*', key: 'name', width: 30 },
      { header: 'Address', key: 'address', width: 40 },
      { header: 'City', key: 'city', width: 20 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'Country', key: 'country', width: 20 },
      { header: 'Contact Person', key: 'contactPerson', width: 25 },
      { header: 'Contact Phone', key: 'contactPhone', width: 20 },
      { header: 'Contact Email', key: 'contactEmail', width: 30 },
      { header: 'Latitude', key: 'latitude', width: 15 },
      { header: 'Longitude', key: 'longitude', width: 15 },
    ];
    
    // Add row with missing required field (name)
    worksheet.addRow({
      name: '', // Missing required field
      address: '789 Invalid Street',
      city: 'Invalid City',
      state: 'Invalid State',
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    
    // Import should handle gracefully
    const result = await caller.bulkOperations.importSites({
      fileData: base64Data,
    });
    
    expect(result).toBeDefined();
    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should export existing sites to Excel', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.bulkOperations.exportSites();
    
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.filename).toContain('sites_export_');
    expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Verify export can be parsed
    const buffer = Buffer.from(result.data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.getWorksheet('Sites');
    expect(worksheet).toBeDefined();
    
    // Check headers exist
    const headerRow = worksheet?.getRow(1);
    expect(headerRow?.getCell(1).value).toBe('Site Name');
  });
});
