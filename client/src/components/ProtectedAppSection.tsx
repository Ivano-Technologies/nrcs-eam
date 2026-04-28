import DashboardLayout from "@/components/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import ActivityLog from "@/pages/ActivityLog";
import AssetDetail from "@/pages/AssetDetail";
import AssetMap from "@/pages/AssetMap";
import AssetScanner from "@/pages/AssetScanner";
import Assets from "@/pages/Assets";
import AuditTrail from "@/pages/AuditTrail";
import Compliance from "@/pages/Compliance";
import CostAnalytics from "@/pages/CostAnalytics";
import DashboardSettings from "@/pages/DashboardSettings";
import EmailNotifications from "@/pages/EmailNotifications";
import FacilityDetail from "@/pages/FacilityDetail";
import Financial from "@/pages/Financial";
import Home from "@/pages/Home";
import CtnRegistryPage from "@/pages/inventory/CtnRegistryPage";
import InventoryStockOverviewPage from "@/pages/inventory/InventoryStockOverviewPage";
import InventoryRequisitionsPage from "@/pages/inventory/InventoryRequisitionsPage";
import InventoryTransfersRoute from "@/pages/inventory/InventoryTransfersRoute";
import { InventoryImportDraftsRoute, InventoryImportPageRoute } from "@/pages/inventory/InventoryImportRoutes";
import InventoryTrackingPage from "@/pages/inventory/InventoryTrackingPage";
import ReceiptDetail from "@/pages/inventory/ReceiptDetail";
import ReceiptPrint from "@/pages/inventory/ReceiptPrint";
import WaybillDetail from "@/pages/inventory/WaybillDetail";
import WaybillPrint from "@/pages/inventory/WaybillPrint";
import StockCardDetail from "@/pages/inventory/StockCardDetail";
import StockCardPrint from "@/pages/inventory/StockCardPrint";
import BinCardDetail from "@/pages/inventory/BinCardDetail";
import BinCardPrint from "@/pages/inventory/BinCardPrint";
import {
  InventoryBinCardsPage,
  InventoryDistributionsPage,
  InventoryExpiryPage,
  InventoryIssuesPage,
  InventoryKitsPage,
  InventoryMovementsPage,
  InventoryReceiptsPage,
  InventoryStockCardsPage,
  InventoryStockCountsPage,
} from "@/pages/inventory/inventoryShellPages";
import Maintenance from "@/pages/Maintenance";
import MobileWorkOrderDetail from "@/pages/MobileWorkOrderDetail";
import MobileWorkOrders from "@/pages/MobileWorkOrders";
import NotFound from "@/pages/NotFound";
import NotificationPreferences from "@/pages/NotificationPreferences";
import PendingUsers from "@/pages/PendingUsers";
import QuickBooksSettings from "@/pages/QuickBooksSettings";
import ReportScheduling from "@/pages/ReportScheduling";
import Reports from "@/pages/Reports";
import MonthlyWarehouseReport from "@/pages/reports/MonthlyWarehouseReport";
import MonthlyWarehouseReportPrint from "@/pages/reports/MonthlyWarehouseReportPrint";
import WmsCtnAgingReport from "@/pages/reports/WmsCtnAgingReport";
import WmsDonorContributionReport from "@/pages/reports/WmsDonorContributionReport";
import WmsExpiryReport from "@/pages/reports/WmsExpiryReport";
import WmsKitAssemblyReport from "@/pages/reports/WmsKitAssemblyReport";
import WmsLossDamageReport from "@/pages/reports/WmsLossDamageReport";
import WmsReportSuite from "@/pages/reports/WmsReportSuite";
import WmsStockMovementsReport from "@/pages/reports/WmsStockMovementsReport";
import FacilitiesNew from "@/pages/FacilitiesNew";
import { FacilitiesTabRoute } from "@/pages/facilities/FacilitiesTabRoutes";
import Users from "@/pages/Users";
import Vendors from "@/pages/Vendors";
import WarrantyAlerts from "@/pages/WarrantyAlerts";
import Welcome from "@/pages/Welcome";
import WorkOrderDetail from "@/pages/WorkOrderDetail";
import WorkOrders from "@/pages/WorkOrders";
import WorkOrderTemplates from "@/pages/WorkOrderTemplates";
import { appPath } from "@/lib/routes";
import { Redirect, Route, Switch, useRoute } from "wouter";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

/**
 * Authenticated area: all routes live under /app/...
 */
export default function ProtectedAppSection() {
  const [isReceiptPrintRoute] = useRoute("/app/inventory/receipts/:id/print/:copyType");
  const [isWaybillPrintRoute] = useRoute("/app/inventory/issues/:id/print/:copyType");
  const [isStockCardPrintRoute] = useRoute("/app/inventory/tracking/stock-cards/:id/print");
  const [isBinCardPrintRoute] = useRoute("/app/inventory/tracking/bin-cards/:id/print");
  const [isMonthlyReportPrintRoute] = useRoute("/app/reports/wms/monthly-warehouse-report/print/:warehouseId/:year/:month");
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
        <PWAInstallPrompt />
        <DashboardLayout>
        <Switch>
          <Route path="/app" component={Home} />
          <Route path="/app/welcome" component={Welcome} />
          <Route path="/app/assets/:id" component={AssetDetail} />
          <Route path="/app/assets" component={Assets} />
          <Route path="/app/scanner" component={AssetScanner} />
          <Route path="/app/asset-map" component={AssetMap} />
          <Route path="/app/warranty-alerts" component={WarrantyAlerts} />
          <Route path="/app/cost-analytics" component={CostAnalytics} />
          <Route path="/app/audit-trail" component={AuditTrail} />
          <Route path="/app/activity-log" component={ActivityLog} />
          <Route path="/app/administration/activity-log" component={ActivityLog} />
          <Route path="/app/work-orders/:id" component={WorkOrderDetail} />
          <Route path="/app/work-orders" component={WorkOrders} />
          <Route path="/app/mobile-work-orders" component={MobileWorkOrders} />
          <Route path="/app/mobile-work-order/:id" component={MobileWorkOrderDetail} />
          <Route path="/app/work-order-templates" component={WorkOrderTemplates} />
          <Route path="/app/maintenance" component={Maintenance} />
          <Route path="/app/inventory/stock-overview" component={InventoryStockOverviewPage} />
          <Route path="/app/inventory/ctn-registry" component={CtnRegistryPage} />
          <Route path="/app/inventory/tracking" component={InventoryTrackingPage} />
          <Route path="/app/inventory/requisitions" component={InventoryRequisitionsPage} />
          <Route path="/app/inventory/transfers" component={InventoryTransfersRoute} />
          <Route path="/app/inventory/import" component={InventoryImportPageRoute} />
          <Route path="/app/inventory/import/drafts" component={InventoryImportDraftsRoute} />
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
      </>
    </ProtectedRoute>
  );
}
