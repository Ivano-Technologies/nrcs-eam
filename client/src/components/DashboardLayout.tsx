import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { appPath } from "@/lib/routes";
import { LogOut, Settings, Search, User } from "lucide-react";
import { CSSProperties, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { NotificationCenter } from "./NotificationCenter";
import Footer from "./Footer";
import { PageShell } from "@/components/ui/PageShell";
import PageLoader from "@/components/ui/PageLoader";
import { ThemeToggle } from "./ui/ThemeToggle";
import { SidebarGroupedNav } from "./SidebarGroupedNav";
import { SidebarBrand, SidebarEdgeToggle } from "./sidebar/SidebarBrand";
import { MobileBottomNav } from "./MobileBottomNav";
import { GlobalSearch } from "./GlobalSearch";
import { flattenNavItems } from "@/config/appNav";
import { Link } from "wouter";
import { ConnectivityIndicator } from "./ConnectivityIndicator";
import { RoleSwitcher } from "./dashboard/RoleSwitcher";
import { DashboardRolePreviewProvider } from "./dashboard/rolePreviewContext";
import type { UserRole } from "./dashboard/types";
import { SIDEBAR_FADE, SIDEBAR_FULL_WIDTH, SIDEBAR_RAIL_WIDTH, snapSidebarWidth } from "@/lib/sidebarWidth";
import { FullBleedProvider, routeWantsFullBleed, useAutoRail, useFullBleedRegistry } from "@/lib/fullBleed";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const PRESET_WIDTHS = {
  narrow: SIDEBAR_RAIL_WIDTH,
  wide: SIDEBAR_FULL_WIDTH,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { data: userPrefs } = trpc.userPreferences.get.useQuery(undefined, { enabled: !!user });
  /** The user's saved preference. Full bleed never writes this. */
  const [savedSidebarWidth, setSavedSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return snapSidebarWidth(saved ? parseInt(saved, 10) : SIDEBAR_FULL_WIDTH);
  });
  const { active: viewFullBleed, registry } = useFullBleedRegistry();
  // Route driven fold: decided in the same render as the navigation, before the page chunk loads.
  const [layoutLocation] = useLocation();
  const layoutSearch = useSearch();
  const fullBleed = viewFullBleed || routeWantsFullBleed(layoutLocation, layoutSearch);
  const isMobile = useIsMobile();
  const updatePrefs = trpc.userPreferences.update.useMutation();
  const { mutate: mutatePrefs } = updatePrefs;
  /** A saved preference change: local state, localStorage, and the backend preference. */
  const saveWidth = useCallback(
    (width: number) => {
      const snapped = snapSidebarWidth(width);
      setSavedSidebarWidth(snapped);
      if (user) mutatePrefs({ sidebarWidth: snapped });
    },
    [user, mutatePrefs]
  );
  const { width: sidebarWidth, autoRail, inVisit, onManualWidth } = useAutoRail({
    saved: savedSidebarWidth,
    fullBleed,
    isMobile: Boolean(isMobile),
    onSaveWidth: saveWidth,
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, savedSidebarWidth.toString());
  }, [savedSidebarWidth]);

  // Sync the saved preference from the backend (display follows it unless a full bleed visit is open).
  useEffect(() => {
    if (userPrefs?.sidebarWidth) {
      setSavedSidebarWidth(snapSidebarWidth(userPrefs.sidebarWidth));
    }
  }, [userPrefs]);

  if (!user) {
    return null;
  }

  return (
    <FullBleedProvider value={registry}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <DashboardLayoutContent setSidebarWidth={onManualWidth} sidebarWidth={sidebarWidth} autoRail={autoRail} inVisit={inVisit}>
          {children}
        </DashboardLayoutContent>
      </SidebarProvider>
    </FullBleedProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  /** Manual toggle (edge tab or Ctrl+B). Saves the preference, or only sets the visit width inside a full bleed view. */
  setSidebarWidth: (width: number) => void;
  sidebarWidth: number;
  autoRail: boolean;
  inVisit: boolean;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  sidebarWidth,
  autoRail,
  inVisit,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const sidebarCountsQuery = trpc.nav.sidebarCounts.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();

  useEffect(() => {
    void utils.nav.sidebarCounts.invalidate();
    // Intentionally not depending on `utils` — a new utils identity must not
    // retrigger invalidation (and a remount cascade) on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Auto-redirect first-time users to welcome page
  useEffect(() => {
    if (user && !user.hasCompletedOnboarding && location !== appPath("/welcome")) {
      setLocation(appPath("/welcome"));
    }
  }, [user, location, setLocation]);
  const { state } = useSidebar();
  const menuItems = flattenNavItems(user?.role);
  const activeMenuItem =
    menuItems.find((item) => item.path === location) ??
    menuItems.find(
      (item) =>
        item.path !== appPath("/") &&
        (location === item.path || location.startsWith(item.path + "/"))
    );
  const isMobile = useIsMobile();
  const [toggleFeedback, setToggleFeedback] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const rail = sidebarWidth <= PRESET_WIDTHS.narrow;
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** Set by the rail search button: focus the field once the sidebar has unfolded. */
  const focusSearchOnExpandRef = useRef(false);
  useEffect(() => {
    if (rail || !focusSearchOnExpandRef.current) return;
    focusSearchOnExpandRef.current = false;
    searchInputRef.current?.focus({ preventScroll: true });
  }, [rail]);
  const actualRole = useMemo<UserRole>(() => {
    const role = user?.role ?? "staff";
    if (role === "admin") return "Admin";
    if (role === "manager") return "Manager";
    if (role === "staff") return "Staff";
    if (role === "field") return "Field";
    return "Field";
  }, [user?.role]);
  const [effectiveRole, setEffectiveRole] = useState<UserRole>(actualRole);

  useEffect(() => {
    if (actualRole !== "Admin") {
      setEffectiveRole(actualRole);
      return;
    }
    if (effectiveRole === "Admin" || effectiveRole === "Manager" || effectiveRole === "Staff" || effectiveRole === "Field") {
      return;
    }
    setEffectiveRole(actualRole);
  }, [actualRole, effectiveRole]);

  const toggleSidebarWidth = () => {
    const newWidth = sidebarWidth === PRESET_WIDTHS.narrow ? PRESET_WIDTHS.wide : PRESET_WIDTHS.narrow;
    setSidebarWidth(newWidth);
    setToggleFeedback(true);
    setTimeout(() => setToggleFeedback(false), 300);
  };

  const openSearchFromRail = () => {
    focusSearchOnExpandRef.current = true;
    toggleSidebarWidth();
  };

  // Keyboard shortcut for sidebar toggle (Ctrl+B / Cmd+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebarWidth();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarWidth, setSidebarWidth]);

  return (
    <DashboardRolePreviewProvider actualRole={actualRole} effectiveRole={effectiveRole} setEffectiveRole={setEffectiveRole}>
      <div className="relative" data-testid="app-sidebar" data-auto-rail={autoRail ? "true" : "false"} data-full-bleed={inVisit ? "true" : "false"} data-sidebar-width={sidebarWidth}>
        <Sidebar className="border-r-0" data-rail={rail ? "true" : "false"}>
          <SidebarHeader
            data-testid="sidebar-header"
            className={cn(
              "h-14 shrink-0 flex-row items-center border-b border-sidebar-border py-0 transition-[padding] duration-200 ease-in-out",
              // Rail: 12 + 40px logo + 12 = 64, so the logo sits centred without changing size.
              rail ? "px-3" : "px-2"
            )}
          >
            <SidebarBrand rail={rail} />
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Search bar: kept mounted in the rail (same height, so nav items never jump); the
                field fades out and the icon becomes a button that unfolds the sidebar and focuses it. */}
            <div className="px-3 py-2 border-b border-sidebar-border">
              <div className="relative">
                {rail ? (
                  <button
                    type="button"
                    onClick={openSearchFromRail}
                    aria-label="Search menu"
                    data-testid="sidebar-search-rail"
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Search aria-hidden className="h-[20px] w-[20px]" />
                  </button>
                ) : (
                  <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-[20px] w-[20px] text-muted-foreground" />
                )}
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search menu…"
                  aria-label="Search menu"
                  aria-hidden={rail || undefined}
                  tabIndex={rail ? -1 : undefined}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full h-9 pl-8 pr-3 text-[17px] bg-sidebar-accent/50 border border-sidebar-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground",
                    SIDEBAR_FADE,
                    rail ? "opacity-0" : "opacity-100 delay-100"
                  )}
                />
              </div>
            </div>


            <SidebarGroupedNav
              location={location}
              setLocation={setLocation}
              sidebarWidth={sidebarWidth}
              searchQuery={searchQuery}
              userRole={user?.role}
              sidebarCounts={sidebarCountsQuery.data ?? undefined}
            />
          </SidebarContent>

          <SidebarFooter className={cn("space-y-2 py-3 transition-[padding] duration-200 ease-in-out", rail ? "px-1" : "px-3")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="user-menu-trigger"
                  aria-label={
                    sidebarWidth === PRESET_WIDTHS.narrow
                      ? user?.name
                        ? `User menu, ${user.name}`
                        : "User menu"
                      : undefined
                  }
                  className="flex w-full items-center gap-3 overflow-hidden rounded-md px-1 py-1 text-left transition-colors hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Avatar className="h-[47px] w-[47px] border shrink-0">
                    {user?.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt="" className="object-cover" />
                    ) : null}
                    <AvatarFallback className="text-[16px] font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div aria-hidden={rail || undefined} className={cn("min-w-0 flex-1 whitespace-nowrap", SIDEBAR_FADE, rail ? "opacity-0" : "opacity-100 delay-100")}>
                    <p className="text-[13.5px] font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={appPath("/settings")} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation(appPath("/notification-preferences"))}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Notification preferences</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarEdgeToggle
          rail={rail}
          onToggle={toggleSidebarWidth}
          feedback={toggleFeedback}
        />
      </div>

      <SidebarInset className="min-h-svh bg-background dark:bg-[#232323]">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 dark:bg-[#232323]/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-md bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ConnectivityIndicator />
              <GlobalSearch />
              <ThemeToggle />
              <NotificationCenter unreadCount={unreadCount} />
            </div>
          </div>
        )}
        {!isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-[rgba(0,0,0,0.08)] bg-[rgba(255,255,255,0.72)] px-4 text-[#1a2332] [backdrop-filter:blur(12px)] [-webkit-backdrop-filter:blur(12px)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(15,23,42,0.72)] dark:text-[hsl(0_0%_95%)]">
            <div className="flex-1 min-w-0" />
            <GlobalSearch className="min-w-[220px] border-[rgba(0,0,0,0.12)] bg-white/70 text-[#1a2332] hover:bg-white/85 hover:text-[#1a2332] dark:border-white/20 dark:bg-white/10 dark:text-[hsl(0_0%_95%)] dark:hover:bg-white/15 dark:hover:text-[hsl(0_0%_95%)] [&_kbd]:border-[rgba(0,0,0,0.15)] [&_kbd]:bg-white/80 [&_kbd]:text-[#1a2332] dark:[&_kbd]:border-white/30 dark:[&_kbd]:bg-white/10 dark:[&_kbd]:text-[hsl(0_0%_95%)]" />
            <div className="flex items-center gap-2 shrink-0">
              <div className="[&_[data-slot='select-trigger']]:border-[rgba(0,0,0,0.15)] [&_[data-slot='select-trigger']]:bg-white/70 [&_[data-slot='select-trigger']]:text-[#1a2332] [&_[data-slot='select-trigger']]:hover:bg-white/85 [&_[data-slot='select-trigger']_[data-slot='select-value']]:text-[#1a2332] [&_[data-slot='select-trigger']_svg]:text-[#1a2332] dark:[&_[data-slot='select-trigger']]:border-white/20 dark:[&_[data-slot='select-trigger']]:bg-white/10 dark:[&_[data-slot='select-trigger']]:text-[hsl(0_0%_95%)] dark:[&_[data-slot='select-trigger']]:hover:bg-white/15 dark:[&_[data-slot='select-trigger']_[data-slot='select-value']]:text-[hsl(0_0%_95%)] dark:[&_[data-slot='select-trigger']_svg]:text-[hsl(0_0%_95%)] [&_.text-muted-foreground]:text-[#1a2332] dark:[&_.text-muted-foreground]:text-[hsl(0_0%_95%)]">
                <RoleSwitcher actualRole={actualRole} value={effectiveRole} onChange={setEffectiveRole} />
              </div>
              <ConnectivityIndicator />
              <ThemeToggle className="text-[#1a2332] hover:bg-black/5 dark:text-[hsl(0_0%_95%)] dark:hover:bg-white/10" />
              <NotificationCenter
                unreadCount={unreadCount}
                triggerClassName="text-[#1a2332] hover:bg-black/5 dark:text-[hsl(0_0%_95%)] dark:hover:bg-white/10"
              />
            </div>
          </div>
        )}
        <main
          data-testid="app-page-main"
          className={cn("flex-1 overflow-x-clip", isMobile && "pb-20")}
        >
          <PageShell>
            {/* Page chunks load inside the layout: the sidebar and top bar stay mounted on navigation. */}
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </PageShell>
        </main>
        <Footer className={isMobile ? "pb-16" : undefined} />
        {isMobile ? (
          <MobileBottomNav
            location={location}
            setLocation={setLocation}
            userRole={user?.role}
          />
        ) : null}
      </SidebarInset>
    </DashboardRolePreviewProvider>
  );
}
