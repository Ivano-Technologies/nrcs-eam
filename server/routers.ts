import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/authRouter";
import { inventoryV2Router } from "./routers/inventoryV2Router";
import { wmsRouter } from "./routers/wmsRouter";
import {
  depreciationReportRouter,
  insuranceRecordsRouter,
} from "./financeRouters";
import { complianceTrackingRouter } from "./complianceTrackingRouters";
import { verificationRouter } from "./routers/verificationRouter";
import { appSettingsRouter } from "./routers/appSettingsRouter";
import { navRouter } from "./routers/navRouter";
import { assetCategoriesRouter } from "./routers/assetCategoriesRouter";
import { searchRouter } from "./routers/searchRouter";
import { auditLogsRouter } from "./routers/auditLogsRouter";
import { adminRouter } from "./routers/adminRouter";
import { sitesRouter } from "./routers/sitesRouter";
import { facilityPhotosRouter } from "./routers/facilityPhotosRouter";
import { photosRouter } from "./routers/photosRouter";
import { transfersRouter } from "./routers/transfersRouter";
import { userPreferencesRouter } from "./routers/userPreferencesRouter";
import { emailNotificationsRouter } from "./routers/emailNotificationsRouter";
import { pendingUsersRouter } from "./routers/pendingUsersRouter";
import { workOrderTemplatesRouter } from "./routers/workOrderTemplatesRouter";
import { depreciationRouter } from "./routers/depreciationRouter";
import { fleetHealthRouter } from "./routers/fleetHealthRouter";
import { branchScorecardsRouter } from "./routers/branchScorecardsRouter";
import { scheduledReportsRouter } from "./routers/scheduledReportsRouter";
import { reportsRouter } from "./routers/reportsRouter";
import { notificationsRouter } from "./routers/notificationsRouter";
import { usersRouter } from "./routers/usersRouter";
import { workOrdersRouter } from "./routers/workOrdersRouter";
import { maintenanceRouter } from "./routers/maintenanceRouter";
import { inventoryRouter } from "./routers/inventoryRouter";
import { bulkOperationsRouter } from "./routers/bulkOperationsRouter";
import { assetsRouter } from "./routers/assetsRouter";
import { dashboardRouter } from "./routers/dashboardRouter";
import { donorAssetsRouter } from "./donorAssetsRouters";

export const appRouter = router({
  system: systemRouter,

  auth: authRouter,

  appSettings: appSettingsRouter,

  sites: sitesRouter,

  facilityPhotos: facilityPhotosRouter,

  nav: navRouter,

  assetCategories: assetCategoriesRouter,

  assets: assetsRouter,

  workOrders: workOrdersRouter,

  maintenance: maintenanceRouter,

  inventory: inventoryRouter,
  inventoryV2: inventoryV2Router,
  wms: wmsRouter,

  depreciationReport: depreciationReportRouter,
  insuranceRecords: insuranceRecordsRouter,
  complianceTracking: complianceTrackingRouter,
  donorAssets: donorAssetsRouter,

  dashboard: dashboardRouter,

  search: searchRouter,

  users: usersRouter,

  notifications: notificationsRouter,

  // Reports
  reports: reportsRouter,

  fleetHealth: fleetHealthRouter,

  branchScorecards: branchScorecardsRouter,

  verification: verificationRouter,

  // Asset Photos Management
  photos: photosRouter,

  // Scheduled Reports Management
  scheduledReports: scheduledReportsRouter,

  bulkOperations: bulkOperationsRouter,

  transfers: transfersRouter,

  userPreferences: userPreferencesRouter,

  emailNotifications: emailNotificationsRouter,

  depreciation: depreciationRouter,

  pendingUsers: pendingUsersRouter,

  workOrderTemplates: workOrderTemplatesRouter,

  auditLogs: auditLogsRouter,

  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
