import { appPath } from "@/lib/routes";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Landmark,
  MapPin,
  Scan,
  Gift,
  Wrench,
  Boxes,
  Package,
  PackageCheck,
  Truck,
  LayoutList,
  ClipboardList,
  ScanLine,
  ArrowLeftRight,
  FileUp,
  Building2,
  BarChart3,
  FileBarChart,
  ShieldCheck,
  Users,
  History,
  SlidersHorizontal,
  ListChecks,
  AlertTriangle,
  UserPlus,
  TrendingDown,
  Trophy,
  ClipboardCheck,
} from "lucide-react";

export type AppNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Dot path into `nav.sidebarCounts`, e.g. `facilities.branches` or `inventory.stockOverview`. */
  navCountBadge?: string;
  /** When true, item is shown only to admins (e.g. Settings → Users). */
  adminOnly?: boolean;
  /** When true, item is shown only to managers and admins. */
  managerOrAdminOnly?: boolean;
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
      { label: "Asset register", path: appPath("/assets"), icon: Landmark },
      { label: "Asset Map", path: appPath("/asset-map"), icon: MapPin },
      { label: "Asset scanner", path: appPath("/scanner"), icon: Scan },
    ],
  },
  {
    id: "facilities",
    label: "Facilities",
    icon: Building2,
    items: [
      {
        label: "All facilities",
        path: appPath("/facilities/all"),
        icon: Building2,
        navCountBadge: "facilities.all",
      },
      {
        label: "National HQ",
        path: appPath("/facilities/national-hq"),
        icon: Building2,
        navCountBadge: "facilities.nationalHq",
      },
      {
        label: "Branches",
        path: appPath("/facilities/branches"),
        icon: Building2,
        navCountBadge: "facilities.branches",
      },
      {
        label: "Divisions",
        path: appPath("/facilities/divisions"),
        icon: Building2,
        navCountBadge: "facilities.divisions",
      },
      {
        label: "Clinics",
        path: appPath("/facilities/clinics"),
        icon: Building2,
        navCountBadge: "facilities.clinics",
      },
      {
        label: "Warehouses",
        path: appPath("/facilities/warehouses"),
        icon: Building2,
        navCountBadge: "facilities.warehouses",
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    items: [
      {
        label: "Stock overview",
        path: appPath("/inventory/stock-overview"),
        icon: Package,
        navCountBadge: "inventory.stockOverview",
      },
      {
        label: "Inventory tracking",
        path: appPath("/inventory/tracking"),
        icon: LayoutList,
        navCountBadge: "inventory.tracking",
      },
      {
        label: "CTN registry",
        path: appPath("/inventory/ctn-registry"),
        icon: ScanLine,
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
        icon: PackageCheck,
        navCountBadge: "inventory.receipts",
      },
      {
        label: "Shipping and tracking",
        path: appPath("/inventory/issues"),
        icon: Truck,
        navCountBadge: "inventory.issues",
      },
      {
        label: "Import",
        path: appPath("/inventory/import"),
        icon: FileUp,
      },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    items: [
      { label: "Maintenance", path: appPath("/maintenance"), icon: Wrench },
      { label: "Work orders", path: appPath("/work-orders"), icon: ListChecks },
      { label: "Work order templates", path: appPath("/work-order-templates"), icon: ClipboardList },
      { label: "Warranty alerts", path: appPath("/warranty-alerts"), icon: AlertTriangle },
      {
        label: "Depreciation schedule",
        path: appPath("/reports/depreciation-schedule"),
        icon: TrendingDown,
        managerOrAdminOnly: true,
      },
      {
        label: "Fleet health",
        path: appPath("/fleet-health"),
        icon: ShieldCheck,
        managerOrAdminOnly: true,
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart,
    items: [
      { label: "Reports overview", path: appPath("/reports"), icon: FileBarChart },
      { label: "WMS report suite", path: appPath("/reports/wms"), icon: FileBarChart },
      { label: "Monthly warehouse report", path: appPath("/reports/wms/monthly-warehouse-report"), icon: FileBarChart },
      { label: "WMS stock movements", path: appPath("/reports/wms/stock-movements"), icon: ArrowLeftRight },
      { label: "WMS CTN aging", path: appPath("/reports/wms/ctn-aging"), icon: ScanLine },
      { label: "WMS donor contribution", path: appPath("/reports/wms/donor-contribution"), icon: FileBarChart },
      { label: "WMS loss and damage", path: appPath("/reports/wms/loss-damage"), icon: FileBarChart },
      { label: "WMS kit assembly", path: appPath("/reports/wms/kit-assembly"), icon: Boxes },
      { label: "Report scheduling", path: appPath("/report-scheduling"), icon: FileBarChart },
      {
        label: "Donor assets report",
        path: appPath("/assets/donors"),
        icon: Gift,
      },
      {
        label: "Branch scorecards",
        path: appPath("/reports/branch-scorecards"),
        icon: Trophy,
        managerOrAdminOnly: true,
      },
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
      { label: "Pending users", path: appPath("/settings/pending-users"), icon: UserPlus },
      {
        label: "Compliance register",
        path: appPath("/administration/compliance-register"),
        icon: ShieldCheck,
      },
      { label: "Activity log", path: appPath("/administration/activity-log"), icon: History },
      {
        label: "Verification campaigns",
        path: appPath("/administration/verification-campaigns"),
        icon: ClipboardCheck,
      },
      { label: "System health", path: appPath("/administration/observability"), icon: BarChart3 },
    ],
  },
];

/** Standalone bottom items, exact order: Settings, then Activity Log (not in collapsible groups). */
export const SIDEBAR_BOTTOM: AppNavItem[] = [
  { label: "Settings", path: appPath("/settings"), icon: SlidersHorizontal },
];

const GROUP_PREFIXES: { groupId: string; pathPrefix: string }[] = [
  { groupId: "assets", pathPrefix: appPath("/assets") },
  { groupId: "assets", pathPrefix: appPath("/asset-map") },
  { groupId: "assets", pathPrefix: appPath("/scanner") },
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
  { groupId: "inventory", pathPrefix: appPath("/inventory/import") },
  { groupId: "inventory", pathPrefix: appPath("/inventory") },
  { groupId: "maintenance", pathPrefix: appPath("/maintenance") },
  { groupId: "maintenance", pathPrefix: appPath("/work-orders") },
  { groupId: "maintenance", pathPrefix: appPath("/work-order-templates") },
  { groupId: "maintenance", pathPrefix: appPath("/warranty-alerts") },
  { groupId: "maintenance", pathPrefix: appPath("/mobile-work-orders") },
  { groupId: "maintenance", pathPrefix: appPath("/mobile-work-order") },
  { groupId: "maintenance", pathPrefix: appPath("/reports/depreciation-schedule") },
  { groupId: "maintenance", pathPrefix: appPath("/fleet-health") },
  { groupId: "administration", pathPrefix: appPath("/administration/compliance-register") },
  { groupId: "reports", pathPrefix: appPath("/assets/donors") },
  { groupId: "reports", pathPrefix: appPath("/reports") },
  { groupId: "reports", pathPrefix: appPath("/report-scheduling") },
  { groupId: "administration", pathPrefix: appPath("/settings/users") },
  { groupId: "administration", pathPrefix: appPath("/settings/pending-users") },
  { groupId: "administration", pathPrefix: appPath("/administration/activity-log") },
  { groupId: "administration", pathPrefix: appPath("/administration/observability") },
  // Legacy aliases still routed in app shell.
  { groupId: "administration", pathPrefix: appPath("/pending-users") },
  { groupId: "settings", pathPrefix: appPath("/settings") },
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
  const isManagerOrAdmin = role === "admin" || role === "manager";
  const items: AppNavItem[] = [...SIDEBAR_TOP];
  for (const g of SIDEBAR_GROUPS) {
    items.push(...g.items.filter((i) => !i.managerOrAdminOnly || isManagerOrAdmin));
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

function normalizeNavPath(path: string): string {
  return (path.split("?")[0] || "/").replace(/\/$/, "") || "/";
}

/**
 * The single active sidebar item for a location: an exact path match wins; otherwise the longest
 * parent path (so `/app/assets/123` keeps Asset register lit). Never more than one item.
 * `extraMatchers` lets callers claim related routes (Inventory tracking owns movements, counts, etc.).
 */
export function activeNavPath(
  location: string,
  paths: string[],
  extraMatchers: { path: string; matches: (loc: string) => boolean }[] = []
): string | null {
  const loc = normalizeNavPath(location);
  const normalized = paths.map(normalizeNavPath);
  const exact = normalized.find((p) => p === loc);
  if (exact) return exact;
  let best: string | null = null;
  for (const p of normalized) {
    if (p === "/app" || p === "/") continue;
    if (loc.startsWith(`${p}/`) && (!best || p.length > best.length)) best = p;
  }
  for (const m of extraMatchers) {
    const mp = normalizeNavPath(m.path);
    if (!normalized.includes(mp) || !m.matches(loc)) continue;
    if (!best || mp.length > best.length) best = mp;
  }
  return best;
}
