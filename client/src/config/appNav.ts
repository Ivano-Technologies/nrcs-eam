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
} from "lucide-react";
import { NairaIcon } from "@/components/icons/NairaIcon";

export type AppNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
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
    items: [{ label: "Facilities", path: appPath("/facilities"), icon: MapPin }],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Warehouse,
    items: [{ label: "Inventory", path: appPath("/inventory"), icon: Warehouse }],
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
      { label: "Report Scheduling", path: appPath("/report-scheduling"), icon: FileBarChart },
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
      { label: "Vendors", path: appPath("/vendors"), icon: Users },
      { label: "Users", path: appPath("/users"), icon: Users },
      { label: "Pending Users", path: appPath("/pending-users"), icon: Users },
      { label: "Notifications", path: appPath("/email-notifications"), icon: Mail },
    ],
  },
];

/** Standalone bottom items, exact order: Settings, then Activity Log (not in collapsible groups). */
export const SIDEBAR_BOTTOM: AppNavItem[] = [
  { label: "Settings", path: appPath("/dashboard-settings"), icon: Settings },
  { label: "Activity Log", path: appPath("/activity-log"), icon: History },
];

const GROUP_PREFIXES: { groupId: string; pathPrefix: string }[] = [
  { groupId: "assets", pathPrefix: appPath("/assets") },
  { groupId: "facilities", pathPrefix: appPath("/facilities") },
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
  { groupId: "administration", pathPrefix: appPath("/vendors") },
  { groupId: "administration", pathPrefix: appPath("/users") },
  { groupId: "administration", pathPrefix: appPath("/pending-users") },
  { groupId: "administration", pathPrefix: appPath("/email-notifications") },
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
  items.push(...SIDEBAR_BOTTOM);
  return items;
}
