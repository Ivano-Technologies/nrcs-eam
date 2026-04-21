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
import {
  SIDEBAR_BOTTOM,
  SIDEBAR_GROUPS,
  SIDEBAR_GROUPS_ADMIN,
  SIDEBAR_STANDALONE_MID,
  SIDEBAR_TOP,
  groupIdForPath,
  type AppNavGroup,
  type AppNavItem,
} from "@/config/appNav";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export type SidebarNavCountsPayload = NonNullable<
  inferRouterOutputs<AppRouter>["nav"]["sidebarCounts"]
>;

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
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "sidebar-nav-groups-open-v1";
const NARROW_PX = 80;

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
  const isAdmin = userRole === "admin";

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
    if (!q) return SIDEBAR_GROUPS;
    return SIDEBAR_GROUPS.map((g) => filterGroup(g, q)).filter(Boolean) as AppNavGroup[];
  }, [q]);

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
  const bottomItems = useMemo(() => filterItems(SIDEBAR_BOTTOM, searchQuery), [searchQuery]);

  const renderItemButton = (item: AppNavItem) => {
    const base = item.path.replace(/\/$/, "") || "/";
    const loc = location.replace(/\/$/, "") || "/";
    const isActive =
      loc === base || (base !== "/app" && loc.startsWith(base + "/"));
    const badge = item.navCountBadge ? navBadgeValue(sidebarCounts ?? undefined, item.navCountBadge) : undefined;
    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          isActive={isActive}
          data-testid={sidebarNavTestId(item.path)}
          onClick={() => setLocation(item.path)}
          tooltip={isNarrow ? item.label : undefined}
          className={cn("h-10 transition-all font-normal", isNarrow ? "justify-center" : "")}
        >
          <item.icon className={cn("h-[20px] w-[20px]", isActive ? "text-primary" : "")} />
          {!isNarrow && (
            <span className="flex min-w-0 flex-1 items-baseline gap-0.5">
              <span className="truncate text-[15px]">{item.label}</span>
              {badge != null ? (
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">· {badge}</span>
              ) : null}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (g: AppNavGroup) => {
    const open = isGroupExpanded(g.id);
    if (q && g.items.length === 0) return null;

    const headerBtn = (
      <button
        type="button"
        title={isNarrow ? g.label : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[15px] font-normal text-white transition-colors",
          "bg-sidebar-accent/40 hover:bg-sidebar-accent/70",
          isNarrow && "justify-center px-0"
        )}
        aria-expanded={open}
      >
        <g.icon className="h-4 w-4 shrink-0 text-white" />
        {!isNarrow && <span className="flex-1 truncate">{g.label}</span>}
        {!isNarrow && (
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-white transition-transform duration-200 ease-out",
              open && "rotate-90"
            )}
          />
        )}
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
          {isNarrow ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>{headerBtn}</CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {g.label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <CollapsibleTrigger asChild>{headerBtn}</CollapsibleTrigger>
          )}
        </SidebarMenuItem>
        <CollapsibleContent className="overflow-hidden transition-[height] duration-200 ease-in-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <SidebarMenu className="ml-1 border-l border-sidebar-border pl-1">
            {g.items.map((item) => renderItemButton(item))}
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
