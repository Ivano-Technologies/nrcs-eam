import DashboardLayout from "@/components/DashboardLayout";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageLoader from "@/components/ui/PageLoader";
import { appPath } from "@/lib/routes";
import { lazy, Suspense } from "react";
import { Redirect, Route, Switch, useRoute } from "wouter";

const ActivityLog = lazy(() => import("@/pages/ActivityLog"));
const Observability = lazy(() => import("@/pages/Administration/Observability"));
const AssetDetail = lazy(() => import("@/pages/AssetDetail"));
const AssetMap = lazy(() => import("@/pages/AssetMap"));
const AssetScanner = lazy(() => import("@/pages/AssetScanner"));
const Assets = lazy(() => import("@/pages/Assets"));
const DonorAssets = lazy(() => import("@/pages/assets/DonorAssets"));
const AuditTrail = lazy(() => import("@/pages/AuditTrail"));
const Compliance = lazy(() => import("@/pages/Compliance"));
/** Dev-only — lazy import gated so production builds exclude showcase (and streamdown/mermaid). */
const DevShowcaseRoute = import.meta.env.DEV
  ? lazy(() =>
      import("@/pages/ComponentShowcase").catch((err: unknown) => {
        console.error("[dev/showcase] failed to load ComponentShowcase", err);
        return {
          default: function ComponentShowcaseLoadError() {
            return (
              <div className="container mx-auto space-y-2 p-6 text-destructive">
                <h1 className="text-lg font-semibold">Showcase failed to load</h1>
                <pre className="whitespace-pre-wrap text-sm">{String(err)}</pre>
              </div>
            );
          },
        };
      })
    )
  : null;
const AssetValuation = lazy(() => import("@/pages/AssetValuation"));
const CostManagement = lazy(() => import("@/pages/finance/CostManagement"));
const CostAnalyticsRedirect = lazy(() =>
  import("@/pages/finance/CostManagement").then((m) => ({
    default: m.CostAnalyticsRedirect,
  }))
);
const DepreciationReporting = lazy(() => import("@/pages/finance/DepreciationReporting"));
const InsuranceRegister = lazy(() => import("@/pages/compliance/InsuranceRegister"));
const AnnualFinanceReport = lazy(() => import("@/pages/reports/AnnualFinanceReport"));
const DashboardSettings = lazy(() => import("@/pages/DashboardSettings"));
const EmailNotifications = lazy(() => import("@/pages/EmailNotifications"));
const FacilityDetail = lazy(() => import("@/pages/FacilityDetail"));
const Financial = lazy(() => import("@/pages/Financial"));
const Home = lazy(() => import("@/pages/Home"));
const CtnRegistryPage = lazy(() => import("@/pages/inventory/CtnRegistryPage"));
const InventoryStockOverviewPage = lazy(() =>
  import("@/pages/inventory/InventoryStockOverviewPage")
);
const InventoryRequisitionsPage = lazy(() =>
  import("@/pages/inventory/InventoryRequisitionsPage")
);
const InventoryTransfersRoute = lazy(() =>
  import("@/pages/inventory/InventoryTransfersRoute")
);
const InventoryImportDraftsRoute = lazy(() =>
  import("@/pages/inventory/InventoryImportRoutes").then((m) => ({
    default: m.InventoryImportDraftsRoute,
  }))
);
const InventoryImportPageRoute = lazy(() =>
  import("@/pages/inventory/InventoryImportRoutes").then((m) => ({
    default: m.InventoryImportPageRoute,
  }))
);
const InventoryTrackingPage = lazy(() => import("@/pages/inventory/InventoryTrackingPage"));
const ReceiptDetail = lazy(() => import("@/pages/inventory/ReceiptDetail"));
const ReceiptPrint = lazy(() => import("@/pages/inventory/ReceiptPrint"));
const WaybillDetail = lazy(() => import("@/pages/inventory/WaybillDetail"));
const WaybillPrint = lazy(() => import("@/pages/inventory/WaybillPrint"));
const StockCardDetail = lazy(() => import("@/pages/inventory/StockCardDetail"));
const StockCardPrint = lazy(() => import("@/pages/inventory/StockCardPrint"));
const BinCardDetail = lazy(() => import("@/pages/inventory/BinCardDetail"));
const BinCardPrint = lazy(() => import("@/pages/inventory/BinCardPrint"));
const InventoryBinCardsPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryBinCardsPage,
  }))
);
const InventoryDistributionsPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryDistributionsPage,
  }))
);
const InventoryExpiryPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryExpiryPage,
  }))
);
const InventoryIssuesPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryIssuesPage,
  }))
);
const InventoryKitsPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryKitsPage,
  }))
);
const InventoryMovementsPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryMovementsPage,
  }))
);
const InventoryReceiptsPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryReceiptsPage,
  }))
);
const InventoryStockCardsPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryStockCardsPage,
  }))
);
const InventoryStockCountsPage = lazy(() =>
  import("@/pages/inventory/inventoryShellPages").then((m) => ({
    default: m.InventoryStockCountsPage,
  }))
);
const Maintenance = lazy(() => import("@/pages/Maintenance"));
const MobileWorkOrderDetail = lazy(() => import("@/pages/MobileWorkOrderDetail"));
const MobileWorkOrders = lazy(() => import("@/pages/MobileWorkOrders"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const NotificationPreferences = lazy(() => import("@/pages/NotificationPreferences"));
const PendingUsers = lazy(() => import("@/pages/PendingUsers"));
const QuickBooksSettings = lazy(() => import("@/pages/QuickBooksSettings"));
const ReportScheduling = lazy(() => import("@/pages/ReportScheduling"));
const Reports = lazy(() => import("@/pages/Reports"));
const MonthlyWarehouseReport = lazy(() =>
  import("@/pages/reports/MonthlyWarehouseReport")
);
const MonthlyWarehouseReportPrint = lazy(() =>
  import("@/pages/reports/MonthlyWarehouseReportPrint")
);
const WmsCtnAgingReport = lazy(() => import("@/pages/reports/WmsCtnAgingReport"));
const WmsDonorContributionReport = lazy(() =>
  import("@/pages/reports/WmsDonorContributionReport")
);
const WmsExpiryReport = lazy(() => import("@/pages/reports/WmsExpiryReport"));
const WmsKitAssemblyReport = lazy(() => import("@/pages/reports/WmsKitAssemblyReport"));
const WmsLossDamageReport = lazy(() => import("@/pages/reports/WmsLossDamageReport"));
const WmsReportSuite = lazy(() => import("@/pages/reports/WmsReportSuite"));
const WmsStockMovementsReport = lazy(() =>
  import("@/pages/reports/WmsStockMovementsReport")
);
const FacilitiesNew = lazy(() => import("@/pages/FacilitiesNew"));
const FacilitiesTabRoute = lazy(() =>
  import("@/pages/facilities/FacilitiesTabRoutes").then((m) => ({
    default: m.FacilitiesTabRoute,
  }))
);
const Users = lazy(() => import("@/pages/Users"));
const Vendors = lazy(() => import("@/pages/Vendors"));
const WarrantyAlerts = lazy(() => import("@/pages/WarrantyAlerts"));
const Welcome = lazy(() => import("@/pages/Welcome"));
const WorkOrderDetail = lazy(() => import("@/pages/WorkOrderDetail"));
const WorkOrders = lazy(() => import("@/pages/WorkOrders"));
const WorkOrderTemplates = lazy(() => import("@/pages/WorkOrderTemplates"));

function ProtectedSectionSuspenseFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
        role="status"
        aria-label="Loading page"
      />
    </div>
  );
}

/**
 * Authenticated area: all routes live under /app/...
 */
function ProtectedAppSectionRoutes() {
  const [isReceiptPrintRoute] = useRoute("/app/inventory/receipts/:id/print/:copyType");
  const [isWaybillPrintRoute] = useRoute("/app/inventory/issues/:id/print/:copyType");
  const [isStockCardPrintRoute] = useRoute("/app/inventory/tracking/stock-cards/:id/print");
  const [isBinCardPrintRoute] = useRoute("/app/inventory/tracking/bin-cards/:id/print");
  const [isMonthlyReportPrintRoute] = useRoute(
    "/app/reports/wms/monthly-warehouse-report/print/:warehouseId/:year/:month"
  );
  if (isReceiptPrintRoute) {
    return (
      <ProtectedRoute>
        <Route path="/app/inventory/receipts/:id/print/:copyType" component={ReceiptPrint} />
      </ProtectedRoute>
    );
  }
  if (isWaybillPrintRoute) {
    return (
      <ProtectedRoute>
        <Route path="/app/inventory/issues/:id/print/:copyType" component={WaybillPrint} />
      </ProtectedRoute>
    );
  }
  if (isStockCardPrintRoute) {
    return (
      <ProtectedRoute>
        <Route path="/app/inventory/tracking/stock-cards/:id/print" component={StockCardPrint} />
      </ProtectedRoute>
    );
  }
  if (isBinCardPrintRoute) {
    return (
      <ProtectedRoute>
        <Route path="/app/inventory/tracking/bin-cards/:id/print" component={BinCardPrint} />
      </ProtectedRoute>
    );
  }
  if (isMonthlyReportPrintRoute) {
    return (
      <ProtectedRoute>
        <Route
          path="/app/reports/wms/monthly-warehouse-report/print/:warehouseId/:year/:month"
          component={MonthlyWarehouseReportPrint}
        />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <>
        <DashboardLayout>
          <Switch>
            {import.meta.env.DEV && DevShowcaseRoute ? (
              <Route path="/app/showcase">
                <Suspense fallback={<PageLoader className="p-4 sm:p-6" />}>
                  <DevShowcaseRoute />
                </Suspense>
              </Route>
            ) : null}
            <Route path="/app" component={Home} />
            <Route path="/app/welcome" component={Welcome} />
            <Route path="/app/assets/donors" component={DonorAssets} />
            <Route path="/app/assets/:id" component={AssetDetail} />
            <Route path="/app/assets" component={Assets} />
            <Route path="/app/scanner" component={AssetScanner} />
            <Route path="/app/asset-map" component={AssetMap} />
            <Route path="/app/warranty-alerts" component={WarrantyAlerts} />
            <Route path="/app/cost-analytics" component={CostAnalyticsRedirect} />
            <Route path="/app/finance/cost-management" component={CostManagement} />
            <Route path="/app/finance/depreciation" component={DepreciationReporting} />
            <Route path="/app/finance/asset-valuation" component={AssetValuation} />
            <Route path="/app/audit-trail" component={AuditTrail} />
            <Route path="/app/activity-log" component={ActivityLog} />
            <Route path="/app/administration/activity-log" component={ActivityLog} />
            <Route path="/app/administration/observability" component={Observability} />
            <Route path="/app/work-orders/:id" component={WorkOrderDetail} />
            <Route path="/app/work-orders" component={WorkOrders} />
            <Route path="/app/mobile-work-orders" component={MobileWorkOrders} />
            <Route path="/app/mobile-work-order/:id" component={MobileWorkOrderDetail} />
            <Route path="/app/work-order-templates" component={WorkOrderTemplates} />
            <Route path="/app/maintenance" component={Maintenance} />
            <Route path="/app/inventory/stock-overview" component={InventoryStockOverviewPage} />
            <Route path="/app/inventory/ctn-registry" component={CtnRegistryPage} />
            <Route path="/app/inventory/import/drafts" component={InventoryImportDraftsRoute} />
            <Route path="/app/inventory/import" component={InventoryImportPageRoute} />
            <Route path="/app/inventory/tracking" component={InventoryTrackingPage} />
            <Route path="/app/inventory/requisitions" component={InventoryRequisitionsPage} />
            <Route path="/app/inventory/transfers" component={InventoryTransfersRoute} />
            <Route path="/app/inventory/receipts/:id/print/:copyType" component={ReceiptPrint} />
            <Route path="/app/inventory/receipts/new" component={ReceiptDetail} />
            <Route path="/app/inventory/receipts/:id" component={ReceiptDetail} />
            <Route path="/app/inventory/receipts" component={InventoryReceiptsPage} />
            <Route path="/app/inventory/issues/:id/print/:copyType" component={WaybillPrint} />
            <Route path="/app/inventory/issues/new" component={WaybillDetail} />
            <Route path="/app/inventory/issues/:id" component={WaybillDetail} />
            <Route path="/app/inventory/issues" component={InventoryIssuesPage} />
            <Route path="/app/inventory/movements" component={InventoryMovementsPage} />
            <Route path="/app/inventory/tracking/stock-cards/:id" component={StockCardDetail} />
            <Route path="/app/inventory/tracking/stock-cards" component={InventoryStockCardsPage} />
            <Route path="/app/inventory/tracking/bin-cards/:id" component={BinCardDetail} />
            <Route path="/app/inventory/tracking/bin-cards" component={InventoryBinCardsPage} />
            <Route path="/app/inventory/counts" component={InventoryStockCountsPage} />
            <Route path="/app/inventory/expiry" component={InventoryExpiryPage} />
            <Route path="/app/inventory/distributions" component={InventoryDistributionsPage} />
            <Route path="/app/inventory/kits" component={InventoryKitsPage} />
            <Route path="/app/inventory/incoming">
              <Redirect to="/app/inventory/receipts" />
            </Route>
            <Route path="/app/inventory/outgoing">
              <Redirect to="/app/inventory/issues" />
            </Route>
            <Route path="/app/inventory/stock-takes">
              <Redirect to="/app/inventory/counts" />
            </Route>
            <Route path="/app/inventory/adjustments">
              <Redirect to="/app/inventory/tracking" />
            </Route>
            <Route path="/app/inventory">
              <Redirect to="/app/inventory/stock-overview" />
            </Route>
            <Route path="/app/vendors" component={Vendors} />
            <Route path="/app/financial" component={Financial} />
            <Route path="/app/compliance" component={Compliance} />
            <Route path="/app/compliance/insurance" component={InsuranceRegister} />
            <Route path="/app/sites/:id">
              {(params) => <Redirect to={`/app/facilities/${params.id}`} />}
            </Route>
            <Route path="/app/sites">
              <Redirect to="/app/facilities/all" />
            </Route>
            <Route path="/app/facilities/new" component={FacilitiesNew} />
            <Route path="/app/facilities/all">
              <FacilitiesTabRoute segment="all" />
            </Route>
            <Route path="/app/facilities/national-hq">
              <FacilitiesTabRoute segment="national-hq" />
            </Route>
            <Route path="/app/facilities/branches">
              <FacilitiesTabRoute segment="branches" />
            </Route>
            <Route path="/app/facilities/divisions">
              <FacilitiesTabRoute segment="divisions" />
            </Route>
            <Route path="/app/facilities/clinics">
              <FacilitiesTabRoute segment="clinics" />
            </Route>
            <Route path="/app/facilities/warehouses">
              <FacilitiesTabRoute segment="warehouses" />
            </Route>
            <Route path="/app/facilities/:id" component={FacilityDetail} />
            <Route path="/app/facilities">
              <Redirect to="/app/facilities/all" />
            </Route>
            <Route path="/app/settings/users" component={Users} />
            <Route path="/app/users">
              <Redirect to={appPath("/settings/users")} />
            </Route>
            <Route path="/app/users/pending" component={PendingUsers} />
            <Route path="/app/settings/pending-users" component={PendingUsers} />
            <Route path="/app/pending-users" component={PendingUsers} />
            <Route path="/app/settings/vendors" component={Vendors} />
            <Route path="/app/settings/notifications" component={NotificationPreferences} />
            <Route path="/app/notification-preferences" component={NotificationPreferences} />
            <Route path="/app/reports" component={Reports} />
            <Route path="/app/reports/annual-finance" component={AnnualFinanceReport} />
            <Route path="/app/reports/wms" component={WmsReportSuite} />
            <Route path="/app/reports/wms/monthly-warehouse-report" component={MonthlyWarehouseReport} />
            <Route path="/app/reports/wms/stock-movements" component={WmsStockMovementsReport} />
            <Route path="/app/reports/wms/ctn-aging" component={WmsCtnAgingReport} />
            <Route path="/app/reports/wms/donor-contribution" component={WmsDonorContributionReport} />
            <Route path="/app/reports/wms/loss-damage" component={WmsLossDamageReport} />
            <Route path="/app/reports/wms/kit-assembly" component={WmsKitAssemblyReport} />
            <Route path="/app/reports/wms/expiry" component={WmsExpiryReport} />
            <Route path="/app/report-scheduling" component={ReportScheduling} />
            <Route path="/app/quickbooks" component={QuickBooksSettings} />
            <Route path="/app/email-notifications" component={EmailNotifications} />
            <Route path="/app/dashboard-settings" component={DashboardSettings} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
        <PWAInstallPrompt />
      </>
    </ProtectedRoute>
  );
}

export default function ProtectedAppSection() {
  return (
    <Suspense fallback={<ProtectedSectionSuspenseFallback />}>
      <ProtectedAppSectionRoutes />
    </Suspense>
  );
}
