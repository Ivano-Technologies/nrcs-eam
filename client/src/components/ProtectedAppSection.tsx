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
import InventoryTrackingPage from "@/pages/inventory/InventoryTrackingPage";
import {
  InventoryDistributionsPage,
  InventoryExpiryPage,
  InventoryIssuesPage,
  InventoryKitsPage,
  InventoryMovementsPage,
  InventoryReceiptsPage,
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
import FacilitiesNew from "@/pages/FacilitiesNew";
import { FacilitiesTabRoute } from "@/pages/facilities/FacilitiesTabRoutes";
import Users from "@/pages/Users";
import Vendors from "@/pages/Vendors";
import WarrantyAlerts from "@/pages/WarrantyAlerts";
import Welcome from "@/pages/Welcome";
import WorkOrderDetail from "@/pages/WorkOrderDetail";
import WorkOrders from "@/pages/WorkOrders";
import WorkOrderTemplates from "@/pages/WorkOrderTemplates";
import { Redirect, Route, Switch } from "wouter";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

/**
 * Authenticated area: all routes live under /app/...
 */
export default function ProtectedAppSection() {
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
          <Route path="/app/inventory/receipts" component={InventoryReceiptsPage} />
          <Route path="/app/inventory/issues" component={InventoryIssuesPage} />
          <Route path="/app/inventory/movements" component={InventoryMovementsPage} />
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
          <Route path="/app/users" component={Users} />
          <Route path="/app/users/pending" component={PendingUsers} />
          <Route path="/app/pending-users" component={PendingUsers} />
          <Route path="/app/notification-preferences" component={NotificationPreferences} />
          <Route path="/app/reports" component={Reports} />
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
