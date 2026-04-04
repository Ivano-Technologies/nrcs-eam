import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";
import * as notificationHelper from "./notificationHelper";
import { generatePDFReport, generateExcelReport } from "./reportGenerator";

// Role-based middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const managerOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager or Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    signup: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // Email domain whitelist
        const allowedDomains = ['redcross.org', 'nrcs.gov.ng', 'gmail.com', 'outlook.com', 'yahoo.com'];
        const emailDomain = input.email.split('@')[1];
        if (!allowedDomains.includes(emailDomain)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Email domain @${emailDomain} is not allowed. Please contact your administrator.`,
          });
        }
        const { createSignupRequest } = await import("./magicLinkAuth");
        return await createSignupRequest(input.email, input.name);
      }),
    requestMagicLink: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          return { success: false, message: "No account found with this email" };
        }
        const { createMagicLinkToken, sendMagicLink } = await import("./magicLinkAuth");
        const token = await createMagicLinkToken(user.id);
        const sent = await sendMagicLink(input.email, token);
        if (sent) {
          return { success: true, message: "Magic link sent to your email" };
        }
        return { success: false, message: "Failed to send magic link" };
      }),
  }),

  // ============= SITES MANAGEMENT =============
  sites: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllSites();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getSiteById(input.id);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().default("Nigeria"),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createSite(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().email().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateSite(id, data);
      }),

    bulkDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteSite(id);
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_delete_site",
              entityType: "site",
              entityId: id,
            });
            deleted++;
          } catch (error) {
            console.error(`Failed to delete site ${id}:`, error);
          }
        }
        return { deleted, total: input.ids.length };
      }),
  }),

  // ============= ASSET CATEGORIES =============
  assetCategories: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllAssetCategories();
    }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createAssetCategory(input.name, input.description);
      }),
  }),

  // ============= ASSETS MANAGEMENT =============
  assets: router({
    list: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAssets(input);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetById(input.id);
      }),
    
    getByTag: protectedProcedure
      .input(z.object({ assetTag: z.string() }))
      .query(async ({ input }) => {
        return await db.getAssetByTag(input.assetTag);
      }),
    
    search: protectedProcedure
      .input(z.object({ searchTerm: z.string() }))
      .query(async ({ input }) => {
        return await db.searchAssets(input.searchTerm);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        assetTag: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        categoryId: z.number(),
        siteId: z.number(),
        status: z.enum(["operational", "maintenance", "repair", "retired", "disposed"]).default("operational"),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        acquisitionDate: z.date().optional(),
        acquisitionCost: z.string().optional(),
        currentValue: z.string().optional(),
        depreciationRate: z.string().optional(),
        warrantyExpiry: z.date().optional(),
        location: z.string().optional(),
        assignedTo: z.number().optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createAsset(input);
      }),
    
    generateQRCode: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { generateAssetQRCode } = await import('./qrcode');
        const asset = await db.getAssetById(input.id);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        
        const qrCode = await generateAssetQRCode(asset.id, asset.assetTag);
        await db.updateAsset(asset.id, { qrCode });
        return { qrCode };
      }),

    generateBulkQRCodeLabels: protectedProcedure
      .input(z.object({
        assetIds: z.array(z.number()),
        labelSize: z.enum(['avery_5160', 'avery_5163', 'custom']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { generateBulkQRCodeLabels } = await import('./qrcode');
        
        // Get assets
        const assets = [];
        for (const id of input.assetIds) {
          const asset = await db.getAssetById(id);
          if (asset) {
            assets.push({
              id: asset.id,
              assetTag: asset.assetTag,
              name: asset.name,
            });
          }
        }
        
        if (assets.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No valid assets found' });
        }
        
        const pdfBuffer = await generateBulkQRCodeLabels(assets, input.labelSize);
        return {
          data: pdfBuffer.toString('base64'),
          filename: `qr-labels-${Date.now()}.pdf`,
          mimeType: 'application/pdf',
        };
      }),
    
    scanQRCode: protectedProcedure
      .input(z.object({ qrData: z.string() }))
      .query(async ({ input }) => {
        const { parseAssetQRCode } = await import('./qrcode');
        const parsed = parseAssetQRCode(input.qrData);
        if (!parsed) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid QR code' });
        
        const asset = await db.getAssetById(parsed.assetId);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        return asset;
      }),

    generateBarcode: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        format: z.enum(['CODE128', 'CODE39', 'EAN13']).default('CODE128'),
      }))
      .mutation(async ({ input }) => {
        const { generateBarcode, generateBarcodeValue } = await import('./barcode');
        const asset = await db.getAssetById(input.id);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        
        const barcodeValue = generateBarcodeValue(asset.assetTag, input.format);
        const barcodeImage = generateBarcode(barcodeValue, input.format);
        
        await db.updateAsset(input.id, {
          barcode: barcodeValue,
          barcodeFormat: input.format,
        });
        
        return { barcode: barcodeValue, image: barcodeImage, format: input.format };
      }),

    scanBarcode: protectedProcedure
      .input(z.object({ barcode: z.string() }))
      .query(async ({ input }) => {
        const asset = await db.getAssetByBarcode(input.barcode);
        if (!asset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        return asset;
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        assetTag: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        categoryId: z.number().optional(),
        siteId: z.number().optional(),
        status: z.enum(["operational", "maintenance", "repair", "retired", "disposed"]).optional(),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        acquisitionDate: z.date().optional(),
        acquisitionCost: z.string().optional(),
        currentValue: z.string().optional(),
        depreciationRate: z.string().optional(),
        warrantyExpiry: z.date().optional(),
        location: z.string().optional(),
        assignedTo: z.number().optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.logAuditEntry({
          userId: ctx.user.id,
          action: 'update',
          entityType: 'asset',
          entityId: id,
          changes: JSON.stringify(data),
        });
        return await db.updateAsset(id, data);
      }),

    getExpiringWarranties: protectedProcedure
      .query(async () => {
        return await db.getExpiringWarranties();
      }),

    sendWarrantyAlert: managerOrAdminProcedure
      .input(z.object({ assetId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const asset = await db.getAssetById(input.assetId);
        if (!asset || !asset.warrantyExpiry) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Asset not found or no warranty expiry date' });
        }

        const daysUntilExpiry = Math.ceil((new Date(asset.warrantyExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        await notificationHelper.sendWarrantyExpirationAlert({
          assetId: asset.id,
          assetName: asset.name,
          assetTag: asset.assetTag,
          warrantyExpiry: asset.warrantyExpiry,
          daysUntilExpiry,
          manufacturer: asset.manufacturer || 'N/A',
          model: asset.model || 'N/A',
        });

        return { success: true };
      }),

    bulkDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteAsset(id);
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_delete_asset",
              entityType: "asset",
              entityId: id,
            });
            deleted++;
          } catch (error) {
            console.error(`Failed to delete asset ${id}:`, error);
          }
        }
        return { deleted, total: input.ids.length };
      }),

    bulkUpdateStatus: managerOrAdminProcedure
      .input(z.object({
        ids: z.array(z.number()),
        status: z.enum(["operational", "maintenance", "repair", "retired", "disposed"]),
      }))
      .mutation(async ({ input, ctx }) => {
        let updated = 0;
        for (const id of input.ids) {
          try {
            await db.updateAsset(id, { status: input.status });
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_update_asset_status",
              entityType: "asset",
              entityId: id,
              changes: JSON.stringify({ status: input.status }),
            });
            updated++;
          } catch (error) {
            console.error(`Failed to update asset ${id}:`, error);
          }
        }
        return { updated, total: input.ids.length };
      }),
  }),

  // ============= WORK ORDERS =============
  workOrders: router({
    list: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        assignedTo: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllWorkOrders(input);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        workOrderNumber: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        assetId: z.number(),
        siteId: z.number(),
        type: z.enum(["corrective", "preventive", "inspection", "emergency"]),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        assignedTo: z.number().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        estimatedCost: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const workOrder = await db.createWorkOrder({
          ...input,
          requestedBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_work_order",
          entityType: "work_order",
          entityId: workOrder?.id,
        });
        
        // Notify assigned user
        if (input.assignedTo && workOrder?.id) {
          await notificationHelper.notifyWorkOrderAssigned(
            input.assignedTo,
            workOrder.id,
            input.title
          );
        }
        
        return workOrder;
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        assignedTo: z.number().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        actualStart: z.date().optional(),
        actualEnd: z.date().optional(),
        estimatedCost: z.string().optional(),
        actualCost: z.string().optional(),
        completionNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        
        // Get existing work order to check for changes
        const existingWorkOrder = await db.getWorkOrderById(id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "update_work_order",
          entityType: "work_order",
          entityId: id,
          changes: JSON.stringify(data),
        });
        
        const result = await db.updateWorkOrder(id, data);
        
        // Notify on status change to completed
        if (data.status === "completed" && existingWorkOrder?.status !== "completed") {
          if (existingWorkOrder?.requestedBy) {
            await notificationHelper.notifyWorkOrderCompleted(
              existingWorkOrder.requestedBy,
              id,
              existingWorkOrder.title
            );
          }
        }
        
        // Notify newly assigned user
        if (data.assignedTo && data.assignedTo !== existingWorkOrder?.assignedTo) {
          await notificationHelper.notifyWorkOrderAssigned(
            data.assignedTo,
            id,
            existingWorkOrder?.title || "Work Order"
          );
        }
        
        return result;
      }),
  }),

  // ============= MAINTENANCE SCHEDULES =============
  maintenance: router({
    list: protectedProcedure
      .input(z.object({
        assetId: z.number().optional(),
        isActive: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllMaintenanceSchedules(input);
      }),
    
    upcoming: protectedProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ input }) => {
        return await db.getUpcomingMaintenance(input.days);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        assetId: z.number(),
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]),
        frequencyValue: z.number().default(1),
        nextDue: z.date(),
        assignedTo: z.number().optional(),
        taskTemplate: z.string().optional(),
        estimatedDuration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const schedule = await db.createMaintenanceSchedule(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_maintenance_schedule",
          entityType: "maintenance_schedule",
          entityId: schedule?.id,
        });
        return schedule;
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]).optional(),
        frequencyValue: z.number().optional(),
        lastPerformed: z.date().optional(),
        nextDue: z.date().optional(),
        assignedTo: z.number().optional(),
        isActive: z.boolean().optional(),
        taskTemplate: z.string().optional(),
        estimatedDuration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "update_maintenance_schedule",
          entityType: "maintenance_schedule",
          entityId: id,
          changes: JSON.stringify(data),
        });
        return await db.updateMaintenanceSchedule(id, data);
      }),

    // Predictive Maintenance AI
    getPredictions: protectedProcedure
      .query(async () => {
        const { getAllMaintenancePredictions } = await import('./predictiveMaintenance');
        return await getAllMaintenancePredictions();
      }),

    getHighPriorityPredictions: protectedProcedure
      .query(async () => {
        const { getHighPriorityPredictions } = await import('./predictiveMaintenance');
        return await getHighPriorityPredictions();
      }),

    getAssetPrediction: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const { analyzeAssetMaintenancePattern } = await import('./predictiveMaintenance');
        return await analyzeAssetMaintenancePattern(input.assetId);
      }),

    autoCreateWorkOrders: managerOrAdminProcedure
      .mutation(async ({ ctx }) => {
        const { autoCreatePreventiveWorkOrders } = await import('./predictiveMaintenance');
        const workOrderIds = await autoCreatePreventiveWorkOrders(ctx.user.id);
        return { created: workOrderIds.length, workOrderIds };
      }),
  }),

  // ============= INVENTORY =============
  inventory: router({
    list: protectedProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllInventoryItems(input?.siteId);
      }),
    
    lowStock: protectedProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getLowStockItems(input?.siteId);
      }),
    
    transactions: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInventoryTransactions(input.itemId);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        itemCode: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        siteId: z.number(),
        currentStock: z.number().default(0),
        minStockLevel: z.number().default(0),
        reorderPoint: z.number().default(0),
        maxStockLevel: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        unitCost: z.string().optional(),
        vendorId: z.number().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createInventoryItem(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        currentStock: z.number().optional(),
        minStockLevel: z.number().optional(),
        reorderPoint: z.number().optional(),
        maxStockLevel: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        unitCost: z.string().optional(),
        vendorId: z.number().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateInventoryItem(id, data);
      }),
    
    addTransaction: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        type: z.enum(["in", "out", "adjustment", "transfer"]),
        quantity: z.number(),
        workOrderId: z.number().optional(),
        fromSiteId: z.number().optional(),
        toSiteId: z.number().optional(),
        unitCost: z.string().optional(),
        totalCost: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const transaction = await db.createInventoryTransaction({
          ...input,
          performedBy: ctx.user.id,
        });
        
        // Update inventory stock
        const item = await db.getAllInventoryItems().then(items => items.find(i => i.id === input.itemId));
        if (item) {
          let newStock = item.currentStock;
          if (input.type === "in") newStock += input.quantity;
          else if (input.type === "out") newStock -= input.quantity;
          else if (input.type === "adjustment") newStock = input.quantity;
          
          await db.updateInventoryItem(input.itemId, { currentStock: newStock });
        }
        
        return transaction;
      }),

    bulkDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await db.deleteInventoryItem(id);
            await db.createAuditLog({
              userId: ctx.user.id,
              action: "bulk_delete_inventory",
              entityType: "inventory",
              entityId: id,
            });
            deleted++;
          } catch (error) {
            console.error(`Failed to delete inventory item ${id}:`, error);
          }
        }
        return { deleted, total: input.ids.length };
      }),
  }),

  // ============= VENDORS =============
  vendors: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllVendors();
    }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        vendorCode: z.string().optional(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        website: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createVendor(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        website: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateVendor(id, data);
      }),
  }),

  // ============= FINANCIAL TRANSACTIONS =============
  financial: router({
    list: protectedProcedure
      .input(z.object({
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getFinancialTransactions(input);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        transactionType: z.enum(["acquisition", "maintenance", "repair", "disposal", "depreciation", "revenue", "other"]),
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        amount: z.string(),
        currency: z.string().default("NGN"),
        description: z.string().optional(),
        transactionDate: z.string(),
        vendorId: z.number().optional(),
        receiptNumber: z.string().optional(),
        approvedBy: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createFinancialTransaction({
          ...input,
          transactionDate: new Date(input.transactionDate),
          createdBy: ctx.user.id,
        });
      }),

    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        transactionType: z.enum(["acquisition", "maintenance", "repair", "disposal", "depreciation", "revenue", "other"]).optional(),
        amount: z.string().optional(),
        description: z.string().optional(),
        transactionDate: z.string().optional(),
        receiptNumber: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.transactionDate) {
          updateData.transactionDate = new Date(data.transactionDate);
        }
        return await db.updateFinancialTransaction(id, updateData);
      }),

    // Lifecycle Cost Analysis
    getAssetLifecycleCost: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const { calculateAssetLifecycleCost } = await import('./lifecycleCost');
        return await calculateAssetLifecycleCost(input.assetId);
      }),

    getCategoryCostSummary: protectedProcedure
      .query(async () => {
        const { getCategoryCostSummary } = await import('./lifecycleCost');
        return await getCategoryCostSummary();
      }),

    getCostOptimizationRecommendations: protectedProcedure
      .query(async () => {
        const { getCostOptimizationRecommendations } = await import('./lifecycleCost');
        return await getCostOptimizationRecommendations();
      }),

    getCostAnalytics: protectedProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ input }) => {
        return await db.getCostAnalytics(input.days);
      }),
  }),

  // ============= COMPLIANCE =============
  compliance: router({
    list: protectedProcedure
      .input(z.object({
        assetId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllComplianceRecords(input);
      }),
    
    create: managerOrAdminProcedure
      .input(z.object({
        assetId: z.number().optional(),
        title: z.string().min(1),
        regulatoryBody: z.string().optional(),
        requirementType: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["compliant", "non_compliant", "pending", "expired"]).default("pending"),
        dueDate: z.date().optional(),
        completionDate: z.date().optional(),
        nextReviewDate: z.date().optional(),
        assignedTo: z.number().optional(),
        documentUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createComplianceRecord(input);
      }),
    
    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        regulatoryBody: z.string().optional(),
        requirementType: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["compliant", "non_compliant", "pending", "expired"]).optional(),
        dueDate: z.date().optional(),
        completionDate: z.date().optional(),
        nextReviewDate: z.date().optional(),
        assignedTo: z.number().optional(),
        documentUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateComplianceRecord(id, data);
      }),
  }),

  // ============= DASHBOARD =============
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
  }),

  // ============= USERS MANAGEMENT =============
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        openId: z.string(),
        name: z.string(),
        email: z.string().email(),
        role: z.enum(["admin", "manager", "technician", "user"]),
        siteId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertUser({
          openId: input.openId,
          name: input.name,
          email: input.email,
          role: input.role,
          lastSignedIn: new Date(),
        });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "manager", "technician", "user"]).optional(),
        siteId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateUser(id, data);
      }),
    
    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "manager", "technician", "user"]),
      }))
      .mutation(async ({ input }) => {
        return await db.updateUserRole(input.userId, input.role);
      }),

    completeOnboarding: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.updateUser(ctx.user.id, { hasCompletedOnboarding: true });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteUser(input.id);
      }),
  }),

  // ============= NOTIFICATIONS =============
  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getUserNotifications(ctx.user.id, input.limit);
      }),
    
    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUnreadNotificationCount(ctx.user.id);
      }),
    
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.markNotificationAsRead(input.id);
      }),
    
    markAllAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        return await db.markAllNotificationsAsRead(ctx.user.id);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteNotification(input.id);
      }),
    
    getPreferences: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserNotificationPreferences(ctx.user.id);
      }),
    
    updatePreferences: protectedProcedure
      .input(z.object({
        maintenanceDue: z.boolean().optional(),
        lowStock: z.boolean().optional(),
        workOrderAssigned: z.boolean().optional(),
        workOrderCompleted: z.boolean().optional(),
        assetStatusChange: z.boolean().optional(),
        complianceDue: z.boolean().optional(),
        systemAlert: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.upsertNotificationPreferences(ctx.user.id, input);
      }),
  }),

  // Reports
  reports: router({
    // Asset Reports
    assetInventory: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        categoryId: z.number().optional(),
        status: z.enum(['operational', 'maintenance', 'retired', 'disposed']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const assets = await db.getAllAssets();

        const columns = [
          { header: 'Asset Tag', key: 'assetTag', width: 15 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Category', key: 'categoryName', width: 15 },
          { header: 'Site', key: 'siteName', width: 20 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Condition', key: 'condition', width: 12 },
          { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
        ];

        const title = 'Asset Inventory Report';
        const subtitle = `Generated for ${input.siteId ? 'Site ' + input.siteId : 'All Sites'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, assets, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `asset-inventory-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, assets, columns, { sheetName: 'Assets' });
          return {
            data: buffer.toString('base64'),
            filename: `asset-inventory-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Maintenance Reports
    maintenanceSchedule: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const schedules = await db.getAllMaintenanceSchedules();

        const columns = [
          { header: 'Schedule Name', key: 'scheduleName', width: 25 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'maintenanceType', width: 15 },
          { header: 'Frequency', key: 'frequency', width: 12 },
          { header: 'Last Performed', key: 'lastPerformed', width: 15 },
          { header: 'Next Due', key: 'nextDue', width: 15 },
          { header: 'Status', key: 'status', width: 12 },
        ];

        const title = 'Maintenance Schedule Report';
        const subtitle = `Period: ${input.startDate || 'All'} to ${input.endDate || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, schedules, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `maintenance-schedule-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, schedules, columns, { sheetName: 'Maintenance' });
          return {
            data: buffer.toString('base64'),
            filename: `maintenance-schedule-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Work Order Reports
    workOrders: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const workOrders = await db.getAllWorkOrders();

        const columns = [
          { header: 'WO Number', key: 'workOrderNumber', width: 15 },
          { header: 'Title', key: 'title', width: 25 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'type', width: 12 },
          { header: 'Priority', key: 'priority', width: 10 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Created', key: 'createdAt', width: 15 },
          { header: 'Completed', key: 'completedAt', width: 15 },
        ];

        const title = 'Work Orders Report';
        const subtitle = `Status: ${input.status || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, workOrders, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `work-orders-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, workOrders, columns, { sheetName: 'Work Orders' });
          return {
            data: buffer.toString('base64'),
            filename: `work-orders-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Financial Reports
    financial: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const transactions = await db.getFinancialTransactions();

        const columns = [
          { header: 'Date', key: 'transactionDate', width: 15 },
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Type', key: 'transactionType', width: 15 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Amount', key: 'amount', width: 12 },
          { header: 'Description', key: 'description', width: 30 },
        ];

        const title = 'Financial Summary Report';
        const subtitle = `Period: ${input.startDate || 'All'} to ${input.endDate || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, transactions, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `financial-report-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, transactions, columns, { sheetName: 'Financial' });
          return {
            data: buffer.toString('base64'),
            filename: `financial-report-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),

    // Compliance Reports
    compliance: protectedProcedure
      .input(z.object({
        format: z.enum(['pdf', 'excel']),
        siteId: z.number().optional(),
        status: z.enum(['compliant', 'non_compliant', 'pending']).optional(),
      }))
      .mutation(async ({ input }) => {
        const records = await db.getAllComplianceRecords();

        const columns = [
          { header: 'Asset', key: 'assetName', width: 20 },
          { header: 'Requirement', key: 'requirementName', width: 25 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Last Inspection', key: 'lastInspectionDate', width: 15 },
          { header: 'Next Due', key: 'nextDueDate', width: 15 },
          { header: 'Inspector', key: 'inspectorName', width: 15 },
        ];

        const title = 'Compliance Audit Report';
        const subtitle = `Status: ${input.status || 'All'}`;

        if (input.format === 'pdf') {
          const buffer = await generatePDFReport(title, records, columns, { subtitle });
          return {
            data: buffer.toString('base64'),
            filename: `compliance-report-${Date.now()}.pdf`,
            mimeType: 'application/pdf',
          };
        } else {
          const buffer = await generateExcelReport(title, records, columns, { sheetName: 'Compliance' });
          return {
            data: buffer.toString('base64'),
            filename: `compliance-report-${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      }),
  }),

  // Asset Photos Management
  photos: router({
    create: protectedProcedure
      .input(z.object({
        assetId: z.number().optional(),
        workOrderId: z.number().optional(),
        photoUrl: z.string(),
        photoKey: z.string(),
        caption: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const photoId = await db.createAssetPhoto({
          ...input,
          uploadedBy: ctx.user.id,
        });
        return { id: photoId };
      }),

    listByAsset: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetPhotos(input.assetId);
      }),

    listByWorkOrder: protectedProcedure
      .input(z.object({ workOrderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderPhotos(input.workOrderId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAssetPhoto(input.id);
        return { success: true };
      }),
  }),

  // Scheduled Reports Management
  scheduledReports: router({
    list: protectedProcedure.query(async () => {
      return await db.getScheduledReports();
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        reportType: z.enum(['assetInventory', 'maintenanceSchedule', 'workOrders', 'financial', 'compliance']),
        format: z.enum(['pdf', 'excel']),
        schedule: z.enum(['daily', 'weekly', 'monthly']),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        time: z.string(),
        recipients: z.string(),
        filters: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const reportId = await db.createScheduledReport({
          ...input,
          createdBy: ctx.user.id,
        });
        return { id: reportId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        reportType: z.enum(['assetInventory', 'maintenanceSchedule', 'workOrders', 'financial', 'compliance']).optional(),
        format: z.enum(['pdf', 'excel']).optional(),
        schedule: z.enum(['daily', 'weekly', 'monthly']).optional(),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        time: z.string().optional(),
        recipients: z.string().optional(),
        filters: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateScheduledReport(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteScheduledReport(input.id);
        return { success: true };
       }),
  }),

  // ============= BULK IMPORT/EXPORT =============
  bulkOperations: router({
    exportAssets: protectedProcedure
      .query(async () => {
        const { exportAssets } = await import('./bulkImportExport');
        const buffer = await exportAssets();
        return {
          data: buffer.toString('base64'),
          filename: `assets_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportWorkOrders: protectedProcedure
      .query(async () => {
        const { exportWorkOrders } = await import('./bulkImportExport');
        const buffer = await exportWorkOrders();
        return {
          data: buffer.toString('base64'),
          filename: `work_orders_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    exportInventory: protectedProcedure
      .query(async () => {
        const { exportInventory } = await import('./bulkImportExport');
        const buffer = await exportInventory();
        return {
          data: buffer.toString('base64'),
          filename: `inventory_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    getImportTemplate: protectedProcedure
      .input(z.object({ entity: z.enum(['assets', 'workOrders', 'inventory']) }))
      .query(async ({ input }) => {
        const { generateImportTemplate } = await import('./bulkImportExport');
        const buffer = await generateImportTemplate(input.entity);
        return {
          data: buffer.toString('base64'),
          filename: `${input.entity}_import_template.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    importAssets: managerOrAdminProcedure
      .input(z.object({ fileData: z.string() })) // base64 encoded
      .mutation(async ({ input, ctx }) => {
        const { importAssets } = await import('./bulkImportExport');
        const buffer = Buffer.from(input.fileData, 'base64');
        return await importAssets(buffer, ctx.user.id);
      }),

    exportSites: protectedProcedure
      .query(async () => {
        const { exportSites } = await import('./bulkImportExport');
        const buffer = await exportSites();
        return {
          data: buffer.toString('base64'),
          filename: `sites_export_${Date.now()}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),

    importSites: managerOrAdminProcedure
      .input(z.object({ fileData: z.string() })) // base64 encoded
      .mutation(async ({ input }) => {
        const { importSites } = await import('./bulkImportExport');
        const buffer = Buffer.from(input.fileData, 'base64');
        return await importSites(buffer);
      }),

    downloadSiteTemplate: publicProcedure
      .query(async () => {
        const { generateSiteTemplate } = await import('./bulkImportExport');
        const buffer = await generateSiteTemplate();
        return {
          data: buffer.toString('base64'),
          filename: 'NRCS_Sites_Import_Template.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }),
  }),

  // ============= ASSET TRANSFERS =============
  transfers: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        assetId: z.number().optional(),
        siteId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllAssetTransfers(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssetTransferById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        fromSiteId: z.number(),
        toSiteId: z.number(),
        reason: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createAssetTransfer({
          ...input,
          requestedBy: ctx.user.id,
        });
      }),

    approve: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'approved',
          approvedBy: ctx.user.id,
          approvalDate: new Date(),
        });
      }),

    reject: managerOrAdminProcedure
      .input(z.object({ id: z.number(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'rejected',
          approvedBy: ctx.user.id,
          approvalDate: new Date(),
          notes: input.notes,
        });
      }),

    startTransfer: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.updateAssetTransfer(input.id, {
          status: 'in_transit',
          transferDate: new Date(),
        });
      }),

    complete: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        handoverChecklist: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const transfer = await db.getAssetTransferById(input.id);
        if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
        
        // Update asset location
        await db.updateAsset(transfer.assetId, {
          siteId: transfer.toSiteId,
        });
        
        return await db.updateAssetTransfer(input.id, {
          status: 'completed',
          completionDate: new Date(),
          handoverChecklist: input.handoverChecklist,
        });
      }),

    getPending: managerOrAdminProcedure
      .query(async () => {
        return await db.getPendingTransferRequests();
      }),
  }),

  // ============= QUICKBOOKS INTEGRATION =============
  quickbooks: router({
    getConfig: protectedProcedure.query(async () => {
      return await db.getQuickBooksConfig();
    }),
    
    saveConfig: protectedProcedure
      .input(z.object({
        clientId: z.string(),
        clientSecret: z.string(),
        redirectUri: z.string(),
        realmId: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await db.saveQuickBooksConfig({
          ...input,
          isActive: 1,
          autoSync: 1,
        });
      }),
    
    getAuthUrl: protectedProcedure
      .input(z.object({
        clientId: z.string(),
        redirectUri: z.string(),
      }))
      .query(({ input }) => {
        const { getQuickBooksAuthUrl } = require('./quickbooksIntegration');
        return { url: getQuickBooksAuthUrl(input) };
      }),
    
    exchangeCode: protectedProcedure
      .input(z.object({
        code: z.string(),
        realmId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const config = await db.getQuickBooksConfig();
        if (!config) throw new Error('QuickBooks not configured');
        
        const { exchangeCodeForToken } = require('./quickbooksIntegration');
        const tokens = await exchangeCodeForToken(input.code, {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });
        
        // Update config with tokens
        const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
        await db.updateQuickBooksTokens(config.id, tokens.accessToken, tokens.refreshToken, expiresAt);
        
        // Update realm ID if provided
        if (input.realmId) {
          await db.saveQuickBooksConfig({
            ...config,
            realmId: input.realmId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenExpiresAt: expiresAt,
          });
        }
        
        return { success: true };
      }),
    
    syncTransactions: protectedProcedure.mutation(async () => {
      const config = await db.getQuickBooksConfig();
      if (!config || !config.accessToken) {
        throw new Error('QuickBooks not authenticated');
      }
      
      const { syncAllTransactions } = require('./quickbooksIntegration');
      const result = await syncAllTransactions({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        realmId: config.realmId,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken || undefined,
      });
      
      await db.updateQuickBooksLastSync(config.id);
      
      return result;
    }),
    
    testConnection: protectedProcedure.query(async () => {
      const config = await db.getQuickBooksConfig();
      if (!config || !config.accessToken) {
        return { connected: false, error: 'Not authenticated' };
      }
      
      const { testConnection } = require('./quickbooksIntegration');
      const connected = await testConnection({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        realmId: config.realmId,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken || undefined,
      });
      
      return { connected };
    }),
  }),

  // ============= USER PREFERENCES =============
  userPreferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserPreferences(ctx.user.id);
    }),
    
    update: protectedProcedure
      .input(z.object({
        sidebarWidth: z.number().optional(),
        sidebarCollapsed: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.upsertUserPreferences({
          userId: ctx.user.id,
          ...input,
        });
      }),

    updateDashboardWidgets: protectedProcedure
      .input(z.object({
        widgets: z.record(z.string(), z.boolean()),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.upsertUserPreferences({
          userId: ctx.user.id,
          dashboardWidgets: JSON.stringify(input.widgets),
        });
      }),
  }),

  // ============= EMAIL NOTIFICATIONS =============
  emailNotifications: router({
    send: adminProcedure
      .input(z.object({
        subject: z.string().min(1),
        body: z.string().min(1),
        recipientType: z.enum(['all', 'individual', 'role']),
        recipientIds: z.array(z.number()).optional(),
        recipientRole: z.enum(['admin', 'manager', 'user']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { sendBulkEmails, generateEmailTemplate } = require('./emailService');
        
        // Get recipient emails based on type
        let recipients: string[] = [];
        
        if (input.recipientType === 'all') {
          const allUsers = await db.getAllUsers();
          recipients = allUsers.filter(u => u.email).map(u => u.email!);
        } else if (input.recipientType === 'individual' && input.recipientIds) {
          const users = await Promise.all(
            input.recipientIds.map(id => db.getUserById(id))
          );
          recipients = users.filter(u => u && u.email).map(u => u!.email!);
        } else if (input.recipientType === 'role' && input.recipientRole) {
          const allUsers = await db.getAllUsers();
          recipients = allUsers
            .filter(u => u.role === input.recipientRole && u.email)
            .map(u => u.email!);
        }
        
        // Send emails
        const htmlBody = generateEmailTemplate(input.body, input.subject);
        const { sent, failed } = await sendBulkEmails(recipients, input.subject, htmlBody);
        
        // Save to history
        await db.createEmailNotification({
          subject: input.subject,
          body: input.body,
          recipientType: input.recipientType,
          recipientIds: input.recipientIds ? JSON.stringify(input.recipientIds) : null,
          recipientRole: input.recipientRole || null,
          sentBy: ctx.user.id,
          status: failed > 0 ? 'failed' : 'sent',
          recipientCount: sent,
        });
        
        return { sent, failed, total: recipients.length };
      }),
    
    history: adminProcedure.query(async () => {
      return await db.getEmailNotificationHistory(100);
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmailNotificationById(input.id);
      }),
  }),

  // ============= DEPRECIATION =============
  depreciation: router({
    calculate: protectedProcedure
      .input(z.object({
        assetId: z.number(),
      }))
      .query(async ({ input }) => {
        const { calculateDepreciation } = require('./depreciation');
        const asset = await db.getAssetById(input.assetId);
        
        if (!asset || !asset.depreciationMethod || asset.depreciationMethod === 'none') {
          return null;
        }
        
        if (!asset.acquisitionCost || !asset.depreciationStartDate) {
          return null;
        }
        
        return calculateDepreciation({
          acquisitionCost: Number(asset.acquisitionCost),
          residualValue: Number(asset.residualValue || 0),
          usefulLifeYears: asset.usefulLifeYears || 5,
          depreciationStartDate: new Date(asset.depreciationStartDate),
          method: asset.depreciationMethod as 'straight-line' | 'declining-balance',
          decliningBalanceRate: 2, // Double-declining balance
        });
      }),
    
    summary: protectedProcedure.query(async () => {
      const { calculateDepreciation } = require('./depreciation');
      const assets = await db.getAllAssets();
      
      let totalAcquisitionCost = 0;
      let totalCurrentValue = 0;
      let totalAccumulatedDepreciation = 0;
      let assetsWithDepreciation = 0;
      
      for (const asset of assets) {
        if (asset.acquisitionCost) {
          totalAcquisitionCost += Number(asset.acquisitionCost);
        }
        
        if (asset.depreciationMethod && asset.depreciationMethod !== 'none' && asset.depreciationStartDate && asset.acquisitionCost) {
          assetsWithDepreciation++;
          const result = calculateDepreciation({
            acquisitionCost: Number(asset.acquisitionCost),
            residualValue: Number(asset.residualValue || 0),
            usefulLifeYears: asset.usefulLifeYears || 5,
            depreciationStartDate: new Date(asset.depreciationStartDate),
            method: asset.depreciationMethod as 'straight-line' | 'declining-balance',
            decliningBalanceRate: 2,
          });
          
          if (result) {
            totalCurrentValue += result.currentBookValue;
            totalAccumulatedDepreciation += result.accumulatedDepreciation;
          }
        } else if (asset.currentValue) {
          totalCurrentValue += Number(asset.currentValue);
        } else if (asset.acquisitionCost) {
          totalCurrentValue += Number(asset.acquisitionCost);
        }
      }
      
      return {
        totalAcquisitionCost: Math.round(totalAcquisitionCost * 100) / 100,
        totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
        totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
        totalDepreciationPercentage: totalAcquisitionCost > 0 
          ? Math.round((totalAccumulatedDepreciation / totalAcquisitionCost) * 10000) / 100 
          : 0,
        assetsWithDepreciation,
        totalAssets: assets.length,
      };
    }),
  }),

  // ============= PENDING USERS (Admin Approval) =============
  pendingUsers: router({
    list: adminProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) return [];
      const { pendingUsers } = await import("../drizzle/schema");
      return await database.select().from(pendingUsers);
    }),
    
    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { approvePendingUser } = await import("./magicLinkAuth");
        return await approvePendingUser(input.id, ctx.user.id);
      }),
    
    reject: adminProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { rejectPendingUser } = await import("./magicLinkAuth");
        return await rejectPendingUser(input.id, ctx.user.id, input.reason);
      }),
  }),

  // ============= WORK ORDER TEMPLATES =============
  workOrderTemplates: router({
    list: protectedProcedure
      .input(z.object({
        isActive: z.boolean().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']).optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getWorkOrderTemplates(input || {});
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkOrderTemplateById(input.id);
      }),

    create: managerOrAdminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        estimatedDuration: z.number().optional(),
        checklistItems: z.string().optional(), // JSON string
        instructions: z.string().optional(),
        categoryId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createWorkOrderTemplate({
          ...input,
          createdBy: ctx.user.id,
          isActive: true,
        });
      }),

    update: managerOrAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(['corrective', 'preventive', 'inspection', 'emergency']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        estimatedDuration: z.number().optional(),
        checklistItems: z.string().optional(),
        instructions: z.string().optional(),
        categoryId: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateWorkOrderTemplate(id, data);
        return { success: true };
      }),

    delete: managerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteWorkOrderTemplate(input.id);
        return { success: true };
      }),
  }),

  // ============= AUDIT LOGS =============
  auditLogs: router({
    list: protectedProcedure
      .input(z.object({
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAuditLogs(input || {});
      }),
  }),
});

export type AppRouter = typeof appRouter;
