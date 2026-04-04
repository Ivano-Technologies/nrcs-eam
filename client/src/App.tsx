import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import VerifyMagicLink from "@/pages/VerifyMagicLink";
import Welcome from "@/pages/Welcome";
import PendingUsers from "./pages/PendingUsers";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import AssetScanner from "./pages/AssetScanner";
import AssetMap from "./pages/AssetMap";
import WorkOrders from "./pages/WorkOrders";
import WorkOrderDetail from "./pages/WorkOrderDetail";
import Maintenance from "./pages/Maintenance";
import Inventory from "./pages/Inventory";
import Vendors from "./pages/Vendors";
import Financial from "./pages/Financial";
import Compliance from "./pages/Compliance";
import Sites from "./pages/Sites";
import Users from "./pages/Users";
import NotificationPreferences from "./pages/NotificationPreferences";
import Reports from "./pages/Reports";
import QuickBooksSettings from "./pages/QuickBooksSettings";
import EmailNotifications from "./pages/EmailNotifications";
import DashboardSettings from "./pages/DashboardSettings";
import WorkOrderTemplates from "./pages/WorkOrderTemplates";
import ReportScheduling from "./pages/ReportScheduling";
import MobileWorkOrders from "./pages/MobileWorkOrders";
import MobileWorkOrderDetail from "./pages/MobileWorkOrderDetail";
import WarrantyAlerts from "./pages/WarrantyAlerts";
import CostAnalytics from "./pages/CostAnalytics";
import AuditTrail from "./pages/AuditTrail";
import ActivityLog from "./pages/ActivityLog";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";

function Router() {
  return (
      <Switch>
        <Route path="/signup" component={Signup} />
        <Route path="/login" component={Login} />
        <Route path="/auth/verify" component={VerifyMagicLink} />
        <Route path="/welcome" component={Welcome} />
      <Route path="/" component={Home} />
      <Route path="/assets" component={Assets} />
        <Route path="/assets/:id" component={AssetDetail} />
        <Route path="/scanner" component={AssetScanner} />
      <Route path="/asset-map" component={AssetMap} />
      <Route path="/warranty-alerts" component={WarrantyAlerts} />
      <Route path="/cost-analytics" component={CostAnalytics} />
      <Route path="/audit-trail" component={AuditTrail} />
      <Route path="/activity-log" component={ActivityLog} />
      <Route path="/work-orders" component={WorkOrders} />
      <Route path="/work-orders/:id" component={WorkOrderDetail} />
      <Route path="/mobile-work-orders" component={MobileWorkOrders} />
      <Route path="/mobile-work-order/:id" component={MobileWorkOrderDetail} />
      <Route path="/work-order-templates" component={WorkOrderTemplates} />
      <Route path="/maintenance" component={Maintenance} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/vendors" component={Vendors} />
      <Route path="/financial" component={Financial} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/sites" component={Sites} />
      <Route path="/users" component={Users} />
      <Route path="/pending-users" component={PendingUsers} />
      <Route path="/notification-preferences" component={NotificationPreferences} />
      <Route path="/reports" component={Reports} />
      <Route path="/report-scheduling" component={ReportScheduling} />
      <Route path="/quickbooks" component={QuickBooksSettings} />
        <Route path="/email-notifications" component={EmailNotifications} />
        <Route path="/dashboard-settings" component={DashboardSettings} />
      <Route path="/legal/terms" component={TermsOfService} />
      <Route path="/legal/privacy" component={PrivacyPolicy} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <PWAInstallPrompt />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
