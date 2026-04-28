import { appPath } from "@/lib/routes";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Map,
  Scan,
  Wrench,
  FileText,
  Boxes,
  Warehouse,
  Shield,
  ShieldCheck,
  FileBarChart,
  MapPin,
  Users,
  History,
  Settings,
  Mail,
  ClipboardList,
  PackagePlus,
  Truck,
  ScanSearch,
} from "lucide-react";
import { NairaIcon } from "@/components/icons/NairaIcon";

export type AppNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Dot path into `nav.sidebarCounts`, e.g. `facilities.branches` or `inventory.stockOverview`. */
  navCountBadge?: string;
  /** When true, item is shown only to admins (e.g. Settings → Users). */
  adminOnly?: boolean;
};

export type AppNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** When true, entire group is omitted unless user is admin */
  adminOnly?: boolean;
  items: AppNavItem[];
};

/** Top item(s) — always visible, not in a collapsible group */
export const SIDEBAR_TOP: AppNavItem[] = [
  { label: "Dashboard", path: appPath("/"), icon: LayoutDashboard },
];

export const SIDEBAR_GROUPS: AppNavGroup[] = [
  {
    id: "assets",
    label: "Assets",
    icon: Boxes,
    items: [
      { label: "Asset Register", path: appPath("/assets"), icon: Package },
      { label: "Asset Map", path: appPath("/asset-map"), icon: Map },
      { label: "Asset Scanner", path: appPath("/scanner"), icon: Scan },
    ],
  },
  {
    id: "facilities",
    label: "Facilities",
    icon: MapPin,
    items: [
      {
        label: "All Facilities",
        path: appPath("/facilities/all"),
        icon: MapPin,
        navCountBadge: "facilities.all",
      },
      {
        label: "National HQ",
        path: appPath("/facilities/national-hq"),
        icon: MapPin,
        navCountBadge: "facilities.nationalHq",
      },
      {
        label: "Branches",
        path: appPath("/facilities/branches"),
        icon: MapPin,
        navCountBadge: "facilities.branches",
      },
      {
        label: "Divisions",
        path: appPath("/facilities/divisions"),
        icon: MapPin,
        navCountBadge: "facilities.divisions",
      },
      {
        label: "Clinics",
        path: appPath("/facilities/clinics"),
        icon: MapPin,
        navCountBadge: "facilities.clinics",
      },
      {
        label: "Warehouses",
        path: appPath("/facilities/warehouses"),
        icon: MapPin,
        navCountBadge: "facilities.warehouses",
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Warehouse,
    items: [
      {
        label: "Stock overview",
        path: appPath("/inventory/stock-overview"),
        icon: Warehouse,
        navCountBadge: "inventory.stockOverview",
      },
      {
        label: "Inventory tracking",
        path: appPath("/inventory/tracking"),
        icon: ScanSearch,
        navCountBadge: "inventory.tracking",
      },
      {
        label: "Order fulfillment",
        path: appPath("/inventory/requisitions"),
        icon: ClipboardList,
        navCountBadge: "inventory.requisitions",
      },
      {
        label: "Receiving",
        path: appPath("/inventory/receipts"),
        icon: PackagePlus,
        navCountBadge: "inventory.receipts",
      },
      {
        label: "Shipping / Tracking",
        path: appPath("/inventory/issues"),
        icon: Truck,
        navCountBadge: "inventory.issues",
      },
      {
        label: "Import",
        path: appPath("/inventory/import"),
        icon: FileText,
      },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    items: [
      { label: "Maintenance", path: appPath("/maintenance"), icon: Wrench },
      { label: "Work Orders", path: appPath("/work-orders"), icon: FileText },
      { label: "Work Order Templates", path: appPath("/work-order-templates"), icon: FileText },
      { label: "Warranty Alerts", path: appPath("/warranty-alerts"), icon: FileText },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: NairaIcon,
    items: [
      { label: "Cost Analytics", path: appPath("/cost-analytics"), icon: NairaIcon },
      { label: "Financial Transactions", path: appPath("/financial"), icon: NairaIcon },
      { label: "QuickBooks", path: appPath("/quickbooks"), icon: NairaIcon },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    items: [
      { label: "Compliance", path: appPath("/compliance"), icon: ShieldCheck },
      { label: "Audit Trail", path: appPath("/audit-trail"), icon: Shield },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart,
    items: [
      { label: "Reports", path: appPath("/reports"), icon: FileBarChart },
      { label: "WMS Report Suite", path: appPath("/reports/wms"), icon: FileBarChart },
      { label: "Monthly Warehouse Report", path: appPath("/reports/wms/monthly-warehouse-report"), icon: FileBarChart },
      { label: "WMS Stock Movements", path: appPath("/reports/wms/stock-movements"), icon: FileBarChart },
      { label: "WMS CTN Aging", path: appPath("/reports/wms/ctn-aging"), icon: FileBarChart },
      { label: "WMS Donor Contribution", path: appPath("/reports/wms/donor-contribution"), icon: FileBarChart },
      { label: "WMS Loss & Damage", path: appPath("/reports/wms/loss-damage"), icon: FileBarChart },
      { label: "WMS Kit Assembly", path: appPath("/reports/wms/kit-assembly"), icon: FileBarChart },
      { label: "Report Scheduling", path: appPath("/report-scheduling"), icon: FileBarChart },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      { label: "Profile", path: appPath("/dashboard-settings"), icon: Settings },
      { label: "Notifications", path: appPath("/settings/notifications"), icon: Mail },
      { label: "System Settings", path: appPath("/email-notifications"), icon: Settings, adminOnly: true },
    ],
  },
];

/** Reserved for future standalone items between Reports and Administration (currently empty). */
export const SIDEBAR_STANDALONE_MID: AppNavItem[] = [];

/** Administration only — Settings is not a group (see `SIDEBAR_BOTTOM`). */
export const SIDEBAR_GROUPS_ADMIN: AppNavGroup[] = [
  {
    id: "administration",
    label: "Administration",
    icon: Users,
    adminOnly: true,
    items: [
      { label: "Users", path: appPath("/settings/users"), icon: Users },
      { label: "Pending Users", path: appPath("/settings/pending-users"), icon: Users },
      { label: "Vendors", path: appPath("/settings/vendors"), icon: Users },
    ],
  },
];

/** Standalone bottom items, exact order: Settings, then Activity Log (not in collapsible groups). */
export const SIDEBAR_BOTTOM: AppNavItem[] = [
  { label: "Activity Log", path: appPath("/activity-log"), icon: History },
];

const GROUP_PREFIXES: { groupId: string; pathPrefix: string }[] = [
  { groupId: "assets", pathPrefix: appPath("/assets") },
  { groupId: "facilities", pathPrefix: appPath("/facilities/all") },
  { groupId: "facilities", pathPrefix: appPath("/facilities/national-hq") },
  { groupId: "facilities", pathPrefix: appPath("/facilities/branches") },
  { groupId: "facilities", pathPrefix: appPath("/facilities/divisions") },
  { groupId: "facilities", pathPrefix: appPath("/facilities/clinics") },
  { groupId: "facilities", pathPrefix: appPath("/facilities/warehouses") },
  { groupId: "facilities", pathPrefix: appPath("/facilities/new") },
  { groupId: "facilities", pathPrefix: appPath("/facilities") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/stock-overview") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/ctn-registry") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/tracking") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/requisitions") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/receipts") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/issues") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/movements") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/transfers") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/counts") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/stock-takes") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/adjustments") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/expiry") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/distributions") },
  { groupId: "inventory", pathPrefix: appPath("/inventory/kits") },
  { groupId: "inventory", pathPrefix: appPath("/inventory") },
  { groupId: "maintenance", pathPrefix: appPath("/maintenance") },
  { groupId: "maintenance", pathPrefix: appPath("/work-orders") },
  { groupId: "maintenance", pathPrefix: appPath("/work-order-templates") },
  { groupId: "maintenance", pathPrefix: appPath("/warranty-alerts") },
  { groupId: "maintenance", pathPrefix: appPath("/mobile-work-orders") },
  { groupId: "maintenance", pathPrefix: appPath("/mobile-work-order") },
  { groupId: "finance", pathPrefix: appPath("/cost-analytics") },
  { groupId: "finance", pathPrefix: appPath("/financial") },
  { groupId: "finance", pathPrefix: appPath("/quickbooks") },
  { groupId: "compliance", pathPrefix: appPath("/compliance") },
  { groupId: "compliance", pathPrefix: appPath("/audit-trail") },
  { groupId: "reports", pathPrefix: appPath("/reports") },
  { groupId: "reports", pathPrefix: appPath("/report-scheduling") },
  { groupId: "administration", pathPrefix: appPath("/settings/users") },
  { groupId: "administration", pathPrefix: appPath("/settings/pending-users") },
  { groupId: "administration", pathPrefix: appPath("/settings/vendors") },
  // Legacy aliases still routed in app shell.
  { groupId: "administration", pathPrefix: appPath("/pending-users") },
  { groupId: "administration", pathPrefix: appPath("/vendors") },
  { groupId: "settings", pathPrefix: appPath("/settings") },
  { groupId: "settings", pathPrefix: appPath("/settings/notifications") },
  { groupId: "settings", pathPrefix: appPath("/email-notifications") },
  { groupId: "settings", pathPrefix: appPath("/dashboard-settings") },
];

/** Longest-prefix match so `/app/assets/123` maps to `assets`. */
export function groupIdForPath(pathname: string): string | null {
  const p = pathname.replace(/\/$/, "") || "/";
  let best: { id: string; len: number } | null = null;
  for (const { groupId, pathPrefix } of GROUP_PREFIXES) {
    const pref = pathPrefix.replace(/\/$/, "");
    if (p === pref || p.startsWith(`${pref}/`)) {
      const len = pref.length;
      if (!best || len > best.len) best = { id: groupId, len };
    }
  }
  return best?.id ?? null;
}

export function flattenNavItems(role: string | undefined): AppNavItem[] {
  const isAdmin = role === "admin";
  const items: AppNavItem[] = [...SIDEBAR_TOP];
  for (const g of SIDEBAR_GROUPS) {
    items.push(...g.items);
  }
  items.push(...SIDEBAR_STANDALONE_MID);
  for (const g of SIDEBAR_GROUPS_ADMIN) {
    if (g.adminOnly && !isAdmin) continue;
    items.push(...g.items);
  }
  for (const item of SIDEBAR_BOTTOM) {
    if (item.adminOnly && !isAdmin) continue;
    items.push(item);
  }
  return items;
}
