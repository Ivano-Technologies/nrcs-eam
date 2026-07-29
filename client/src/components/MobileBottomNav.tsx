import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { appPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

const PRIMARY_GROUP_IDS = ["assets", "facilities", "maintenance"] as const;
type PrimaryGroupId = (typeof PRIMARY_GROUP_IDS)[number];

const MORE_GROUP_IDS = new Set(["inventory", "reports", "administration", "settings"]);

type MobileBottomNavProps = {
  location: string;
  setLocation: (path: string) => void;
  userRole?: string;
};

function filterByRole(items: AppNavItem[], isManagerOrAdmin: boolean): AppNavItem[] {
  return items.filter((i) => !i.managerOrAdminOnly || isManagerOrAdmin);
}

function isDashboardPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === appPath("/") || p === "/app";
}

export function MobileBottomNav({ location, setLocation, userRole }: MobileBottomNavProps) {
  const isAdmin = userRole === "admin";
  const isManagerOrAdmin = userRole === "admin" || userRole === "manager";
  const activeGroupId = groupIdForPath(location);
  const dashboardActive = isDashboardPath(location);
  const moreActive = activeGroupId != null && MORE_GROUP_IDS.has(activeGroupId);

  const [sheet, setSheet] = useState<"more" | PrimaryGroupId | null>(null);

  const primaryGroups = useMemo(() => {
    return PRIMARY_GROUP_IDS.map((id) => {
      const g = SIDEBAR_GROUPS.find((x) => x.id === id);
      if (!g) return null;
      return { ...g, items: filterByRole(g.items, isManagerOrAdmin) };
    }).filter(Boolean) as AppNavGroup[];
  }, [isManagerOrAdmin]);

  const moreGroups = useMemo(() => {
    const fromMain = SIDEBAR_GROUPS.filter((g) => !PRIMARY_GROUP_IDS.includes(g.id as PrimaryGroupId)).map(
      (g) => ({ ...g, items: filterByRole(g.items, isManagerOrAdmin) })
    );
    const fromAdmin = SIDEBAR_GROUPS_ADMIN.filter((g) => !g.adminOnly || isAdmin).map((g) => ({
      ...g,
      items: filterByRole(g.items, isManagerOrAdmin),
    }));
    return [...fromMain, ...fromAdmin];
  }, [isAdmin, isManagerOrAdmin]);

  const moreStandalone = useMemo(() => {
    const mid = filterByRole(SIDEBAR_STANDALONE_MID, isManagerOrAdmin);
    const bottom = SIDEBAR_BOTTOM.filter((i) => !i.adminOnly || isAdmin);
    return [...mid, ...bottom];
  }, [isAdmin, isManagerOrAdmin]);

  const dashboardItem = SIDEBAR_TOP[0];

  const navigate = (path: string) => {
    setSheet(null);
    setLocation(path);
  };

  const onPrimaryGroupTab = (group: AppNavGroup) => {
    // Always open the group sheet so every sidebar leaf stays one tap away
    // from the bottom bar (no reliance on the hamburger for primary groups).
    setSheet(group.id as PrimaryGroupId);
  };

  const sheetGroups: AppNavGroup[] =
    sheet === "more"
      ? moreGroups
      : sheet != null
        ? primaryGroups.filter((g) => g.id === sheet)
        : [];

  const sheetStandalone = sheet === "more" ? moreStandalone : [];
  const sheetTitle =
    sheet === "more"
      ? "More"
      : sheet
        ? primaryGroups.find((g) => g.id === sheet)?.label ?? "Menu"
        : "";

  return (
    <>
      <nav
        data-testid="mobile-bottom-nav"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Primary"
      >
        <ul className="grid h-16 grid-cols-5 items-stretch">
          <li className="min-w-0">
            <button
              type="button"
              data-testid="mobile-nav-dashboard"
              aria-current={dashboardActive ? "page" : undefined}
              onClick={() => navigate(dashboardItem?.path ?? appPath("/"))}
              className={cn(
                "flex h-full w-full touch-manipulation flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium",
                dashboardActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {dashboardItem ? (
                <dashboardItem.icon className={cn("h-5 w-5", dashboardActive && "text-primary")} />
              ) : null}
              <span className="truncate">Dashboard</span>
            </button>
          </li>

          {primaryGroups.map((group) => {
            const active = activeGroupId === group.id;
            return (
              <li key={group.id} className="min-w-0">
                <button
                  type="button"
                  data-testid={`mobile-nav-${group.id}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onPrimaryGroupTab(group)}
                  className={cn(
                    "flex h-full w-full touch-manipulation flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <group.icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span className="truncate">{group.label}</span>
                </button>
              </li>
            );
          })}

          <li className="min-w-0">
            <button
              type="button"
              data-testid="mobile-nav-more"
              aria-current={moreActive || sheet === "more" ? "page" : undefined}
              onClick={() => setSheet("more")}
              className={cn(
                "flex h-full w-full touch-manipulation flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium",
                moreActive || sheet === "more" ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal
                className={cn("h-5 w-5", (moreActive || sheet === "more") && "text-primary")}
              />
              <span className="truncate">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Drawer open={sheet != null} onOpenChange={(open) => !open && setSheet(null)}>
        <DrawerContent className="md:hidden max-h-[80vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{sheetTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-2 pb-6">
            {sheetGroups.map((group) => (
              <div key={group.id} className="mb-4">
                {sheet === "more" ? (
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const base = item.path.replace(/\/$/, "") || "/";
                    const loc = location.replace(/\/$/, "") || "/";
                    const isActive = loc === base || (base !== "/app" && loc.startsWith(`${base}/`));
                    return (
                      <li key={item.path}>
                        <button
                          type="button"
                          data-testid={`mobile-sheet-nav-${item.path.replace(/^\/app\/?/, "").replace(/\//g, "-") || "home"}`}
                          onClick={() => navigate(item.path)}
                          className={cn(
                            "flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px]",
                            isActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-accent"
                          )}
                        >
                          <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {sheetStandalone.length > 0 ? (
              <div className="mb-2">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Settings
                </p>
                <ul className="space-y-0.5">
                  {sheetStandalone.map((item) => {
                    const base = item.path.replace(/\/$/, "") || "/";
                    const loc = location.replace(/\/$/, "") || "/";
                    const isActive = loc === base || loc.startsWith(`${base}/`);
                    return (
                      <li key={item.path}>
                        <button
                          type="button"
                          data-testid={`mobile-sheet-nav-${item.path.replace(/^\/app\/?/, "").replace(/\//g, "-") || "home"}`}
                          onClick={() => navigate(item.path)}
                          className={cn(
                            "flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px]",
                            isActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-accent"
                          )}
                        >
                          <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
