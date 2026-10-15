import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { appPath } from "@/lib/routes";
import { locationMatchesInventoryTracking } from "@/lib/inventoryTrackingNav";
import {
  SIDEBAR_BOTTOM,
  SIDEBAR_GROUPS,
  SIDEBAR_GROUPS_ADMIN,
  SIDEBAR_STANDALONE_MID,
  SIDEBAR_TOP,
  activeNavPath,
  groupIdForPath,
  type AppNavGroup,
  type AppNavItem,
} from "@/config/appNav";
import { SIDEBAR_GROUP_CHEVRON, SIDEBAR_LEAF_TRAIL_ICON } from "@/config/sidebarChevrons";
import { chevronClickTransformClasses } from "@/lib/chevronMotion";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export type SidebarNavCountsPayload = NonNullable<
  inferRouterOutputs<AppRouter>["nav"]["sidebarCounts"]
>;

const INVENTORY_TRACKING_SIDEBAR_PATH = appPath("/inventory/tracking").replace(/\/$/, "") || "/";

function navBadgeValue(
  counts: SidebarNavCountsPayload | null | undefined,
  path: string | undefined
): number | null | undefined {
  if (counts == null || !path) return undefined;
  const [group, key] = path.split(".");
  if (group === "facilities") {
    return counts.facilities[key as keyof typeof counts.facilities];
  }
  if (group === "inventory") {
    return counts.inventory[key as keyof typeof counts.inventory] as number | null | undefined;
  }
  return undefined;
}

import { useEffect, useMemo, useState } from "react";
import { SIDEBAR_FADE, SIDEBAR_RAIL_WIDTH } from "@/lib/sidebarWidth";
import { useSidebar } from "@/components/ui/sidebar";

const STORAGE_KEY = "sidebar-nav-groups-open-v1";
const NARROW_PX = SIDEBAR_RAIL_WIDTH;

/** Stable `data-testid` for Playwright (sidebar navigation). */
export function sidebarNavTestId(path: string): string {
  if (path === "/app" || path === "/app/") return "sidebar-nav-dashboard";
  const sub = path.replace(/^\/app\/?/, "").replace(/\//g, "-") || "home";
  return `sidebar-nav-${sub}`;
}

type SidebarGroupedNavProps = {
  location: string;
  setLocation: (path: string) => void;
  sidebarWidth: number;
  searchQuery: string;
  userRole?: string;
  sidebarCounts?: SidebarNavCountsPayload | null;
};

function filterItems(items: AppNavItem[], q: string): AppNavItem[] {
  if (!q.trim()) return items;
  const s = q.toLowerCase();
  return items.filter((i) => i.label.toLowerCase().includes(s));
}

function filterGroup(g: AppNavGroup, q: string): AppNavGroup | null {
  const items = filterItems(g.items, q);
  if (items.length === 0) return null;
  return { ...g, items };
}

export function SidebarGroupedNav({
  location,
  setLocation,
  sidebarWidth,
  searchQuery,
  userRole,
  sidebarCounts,
}: SidebarGroupedNavProps) {
  const isNarrow = sidebarWidth <= NARROW_PX;
  const { isMobile } = useSidebar();
  /** Labels stay mounted in the rail (no remount or vertical jump while the width animates) and fade. */
  const fade = cn(SIDEBAR_FADE, isNarrow ? "opacity-0" : "opacity-100 delay-100");
  const isAdmin = userRole === "admin";
  const isManagerOrAdmin = userRole === "admin" || userRole === "manager";

  const filterByRole = (items: AppNavItem[]) =>
    items.filter((i) => !i.managerOrAdminOnly || isManagerOrAdmin);

  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      /* ignore */
    }
    return {};
  });

  const activeGroupId = useMemo(() => groupIdForPath(location), [location]);

  useEffect(() => {
    if (!activeGroupId) return;
    setGroupOpen((prev) => {
      if (prev[activeGroupId]) return prev;
      const next = { ...prev, [activeGroupId]: true };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [activeGroupId]);

  const isGroupExpanded = (id: string) => groupOpen[id] ?? false;

  const setExpanded = (id: string, open: boolean) => {
    setGroupOpen((prev) => {
      const next = { ...prev, [id]: open };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const q = searchQuery.trim();
  const groupsMain = useMemo(() => {
    const base = SIDEBAR_GROUPS.map((g) => ({ ...g, items: filterByRole(g.items) }));
    if (!q) return base;
    return base.map((g) => filterGroup(g, q)).filter(Boolean) as AppNavGroup[];
  }, [q, isManagerOrAdmin]);

  const groupsTail = useMemo(() => {
    const raw = SIDEBAR_GROUPS_ADMIN.filter((g) => !g.adminOnly || isAdmin);
    if (!q) return raw;
    return raw.map((g) => filterGroup(g, q)).filter(Boolean) as AppNavGroup[];
  }, [q, isAdmin]);

  const standaloneMid = useMemo(() => {
    if (!q) return SIDEBAR_STANDALONE_MID;
    return filterItems(SIDEBAR_STANDALONE_MID, q);
  }, [q]);

  const topItems = useMemo(() => filterItems(SIDEBAR_TOP, searchQuery), [searchQuery]);
  const bottomItems = useMemo(() => {
    const items = filterItems(SIDEBAR_BOTTOM, searchQuery);
    return items.filter((i) => !i.adminOnly || isAdmin);
  }, [searchQuery, isAdmin]);

  /** Exactly one lit leaf: exact match first, then the closest parent route. */
  const activePath = useMemo(() => {
    const all = [
      ...SIDEBAR_TOP,
      ...SIDEBAR_GROUPS.flatMap((g) => filterByRole(g.items)),
      ...SIDEBAR_STANDALONE_MID,
      ...SIDEBAR_GROUPS_ADMIN.filter((g) => !g.adminOnly || isAdmin).flatMap((g) => g.items),
      ...SIDEBAR_BOTTOM,
    ].map((i) => i.path);
    return activeNavPath(location, all, [
      { path: INVENTORY_TRACKING_SIDEBAR_PATH, matches: locationMatchesInventoryTracking },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, isAdmin, isManagerOrAdmin]);

  const renderItemButton = (item: AppNavItem, subsectionIndex?: number) => {
    const base = item.path.replace(/\/$/, "") || "/";
    const isActive = activePath === base;
    const badge = item.navCountBadge ? navBadgeValue(sidebarCounts ?? undefined, item.navCountBadge) : undefined;
    const TrailIcon = subsectionIndex != null ? SIDEBAR_LEAF_TRAIL_ICON : null;
    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          isActive={isActive}
          data-testid={sidebarNavTestId(item.path)}
          onClick={() => setLocation(item.path)}
          tooltip={{ children: item.label, hidden: !isNarrow || isMobile }}
          aria-label={isNarrow ? item.label : undefined}
          // Rail: (48px button − 16px icon) / 2 = 16px left padding centres the icon in 64px.
          className={cn("h-10 font-normal transition-[padding,background-color,color] duration-200 ease-in-out", isNarrow ? "pl-4" : "")}
        >
          <item.icon className={cn("h-[20px] w-[20px]", isActive ? "text-primary" : "")} />
          <span aria-hidden={isNarrow || undefined} className={cn("flex min-w-0 flex-1 items-center gap-0.5 whitespace-nowrap", fade)}>
            <span className="flex min-w-0 flex-1 items-baseline gap-0.5">
              <span className="truncate text-[15px]">{item.label}</span>
              {badge != null ? (
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">· {badge}</span>
              ) : null}
            </span>
            {TrailIcon ? <TrailIcon className="!h-3.5 !w-3.5 shrink-0 text-sidebar-foreground/40" aria-hidden /> : null}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (g: AppNavGroup) => {
    const open = isGroupExpanded(g.id);
    if (q && g.items.length === 0) return null;

    const chevronDef = SIDEBAR_GROUP_CHEVRON;
    const HeaderChevron = chevronDef.Icon;

    const headerBtn = (
      <button
        type="button"
        aria-label={g.label}
        title={isNarrow ? g.label : undefined}
        className={cn(
          "flex w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded-md border border-transparent py-1.5 pr-2 text-left text-[15px] text-white transition-[background-color,color,transform,padding] duration-200 ease-in-out",
          // Groups show open state (chevron + bold label) but never the active fill.
          "bg-transparent hover:bg-sidebar-accent/50 active:scale-[0.99] motion-reduce:active:scale-100",
          open ? "font-semibold" : "font-normal",
          // Rail: (48px − 16px icon) / 2 = 16px left padding centres the icon in 64px.
          isNarrow ? "pl-4" : "pl-2"
        )}
        aria-expanded={open}
      >
        <g.icon className="h-4 w-4 shrink-0 text-white" />
        <span aria-hidden={isNarrow || undefined} className={cn("flex min-w-0 flex-1 items-center gap-2", fade)}>
          <span className="flex-1 truncate">{g.label}</span>
          <HeaderChevron
            className={cn(
              "h-4 w-4 shrink-0 text-white",
              chevronClickTransformClasses,
              open ? chevronDef.expanded : chevronDef.collapsed
            )}
          />
        </span>
      </button>
    );

    return (
      <Collapsible
        key={g.id}
        open={open}
        onOpenChange={(v) => setExpanded(g.id, v)}
        className="space-y-0"
      >
        <SidebarMenuItem>
          {/* Same tree in both states; the tooltip only shows in the rail. */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>{headerBtn}</CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium" hidden={!isNarrow || isMobile}>
                {g.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenuItem>
        {/* No enter or exit animation on the sub-items: the fade could leave the opened group as an
            empty gap. */}
        <CollapsibleContent className="overflow-hidden">
          <SidebarMenu className="ml-1 border-l border-sidebar-border pl-1">
            {g.items.map((item, idx) => renderItemButton(item, idx))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <SidebarMenu className="px-2 py-1">
      {topItems.map((item) => renderItemButton(item))}

      {groupsMain.map((g) => renderGroup(g))}

      {standaloneMid.map((item) => renderItemButton(item))}

      {groupsTail.map((g) => renderGroup(g))}

      {bottomItems.map((item) => renderItemButton(item))}
    </SidebarMenu>
  );
}
