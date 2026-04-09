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
import Financial from "@/pages/Financial";
import Home from "@/pages/Home";
import Inventory from "@/pages/Inventory";
import Maintenance from "@/pages/Maintenance";
import MobileWorkOrderDetail from "@/pages/MobileWorkOrderDetail";
import MobileWorkOrders from "@/pages/MobileWorkOrders";
import NotFound from "@/pages/NotFound";
import NotificationPreferences from "@/pages/NotificationPreferences";
import PendingUsers from "@/pages/PendingUsers";
import QuickBooksSettings from "@/pages/QuickBooksSettings";
import ReportScheduling from "@/pages/ReportScheduling";
import Reports from "@/pages/Reports";
import Sites from "@/pages/Sites";
import Users from "@/pages/Users";
import Vendors from "@/pages/Vendors";
import WarrantyAlerts from "@/pages/WarrantyAlerts";
import Welcome from "@/pages/Welcome";
import WorkOrderDetail from "@/pages/WorkOrderDetail";
import WorkOrders from "@/pages/WorkOrders";
import WorkOrderTemplates from "@/pages/WorkOrderTemplates";
import { Route, Switch } from "wouter";
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
          <Route path="/app/inventory" component={Inventory} />
          <Route path="/app/vendors" component={Vendors} />
          <Route path="/app/financial" component={Financial} />
          <Route path="/app/compliance" component={Compliance} />
          <Route path="/app/sites" component={Sites} />
          <Route path="/app/users" component={Users} />
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
