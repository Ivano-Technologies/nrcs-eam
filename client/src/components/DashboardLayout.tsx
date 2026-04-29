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
import { LogOut, Settings, Maximize2, Search, User } from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { NotificationCenter } from "./NotificationCenter";
import Footer from "./Footer";
import { ThemeToggle } from "./ui/ThemeToggle";
import { SidebarGroupedNav } from "./SidebarGroupedNav";
import { GlobalSearch } from "./GlobalSearch";
import { InstallPWABanner } from "./InstallPWABanner";
import { flattenNavItems } from "@/config/appNav";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Link } from "wouter";
import { RoleSwitcher } from "./dashboard/RoleSwitcher";
import { DashboardRolePreviewProvider } from "./dashboard/rolePreviewContext";
import type { UserRole } from "./dashboard/types";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 80;
const MAX_WIDTH = 480;
const PRESET_WIDTHS = {
  narrow: 80,
  wide: 360,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { data: userPrefs } = trpc.userPreferences.get.useQuery(undefined, { enabled: !!user });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  // Sync sidebar width with user preferences from backend
  useEffect(() => {
    if (userPrefs?.sidebarWidth) {
      setSidebarWidth(userPrefs.sidebarWidth);
    }
  }, [userPrefs]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} sidebarWidth={sidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  sidebarWidth: number;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  sidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const sidebarCountsQuery = trpc.nav.sidebarCounts.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();

  useEffect(() => {
    void utils.nav.sidebarCounts.invalidate();
  }, [location, utils]);

  // Auto-redirect first-time users to welcome page
  useEffect(() => {
    if (user && !user.hasCompletedOnboarding && location !== appPath("/welcome")) {
      setLocation(appPath("/welcome"));
    }
  }, [user, location, setLocation]);
  const { state } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
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

  const updatePrefsMutation = trpc.userPreferences.update.useMutation();

  const toggleSidebarWidth = () => {
    const currentWidth = sidebarWidth;
    const newWidth = currentWidth === PRESET_WIDTHS.narrow ? PRESET_WIDTHS.wide : PRESET_WIDTHS.narrow;
    setSidebarWidth(newWidth);
    if (user) {
      updatePrefsMutation.mutate({ sidebarWidth: newWidth });
    }
    // Visual feedback
    setToggleFeedback(true);
    setTimeout(() => setToggleFeedback(false), 300);
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
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <DashboardRolePreviewProvider actualRole={actualRole} effectiveRole={effectiveRole} setEffectiveRole={setEffectiveRole}>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          className="border-r-0"
        >
          <SidebarHeader
            className={cn(
              "border-b border-sidebar-border",
              sidebarWidth <= PRESET_WIDTHS.narrow ? "min-h-[4.5rem] py-2 justify-center" : "h-20 justify-center"
            )}
          >
            {sidebarWidth <= PRESET_WIDTHS.narrow ? (
              <div className="flex flex-col items-center gap-2 px-1 w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={appPath("/")}>
                      <div className="flex justify-center w-full rounded-md transition-opacity hover:opacity-80 cursor-pointer">
                        <img
                          src="/nrcs-logo-source.png"
                          alt="Nigerian Red Cross Society"
                          className="h-10 w-10 shrink-0 object-contain mx-auto"
                          data-testid="sidebar-logo-collapsed"
                        />
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Go to Dashboard</TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  onClick={toggleSidebarWidth}
                  className={`h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 border border-sidebar-border hover:border-primary/50 ${toggleFeedback ? "bg-primary/20 scale-110 border-primary" : ""}`}
                  aria-label="Toggle sidebar width (Ctrl+B)"
                  title="Toggle sidebar width (Ctrl+B)"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-sidebar-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 transition-all w-full">
                <div className="min-w-0 flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={appPath("/")}>
                        <div className="flex items-center gap-3 min-w-0 rounded-md px-1 py-1 transition-opacity hover:opacity-80 cursor-pointer">
                          <img
                            src="/nrcs-logo-source.png"
                            alt="Nigerian Red Cross Society"
                            className="h-12 w-12 shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span
                              className="font-bold text-[15px] text-sidebar-foreground truncate"
                              data-testid="sidebar-org-name"
                            >
                              Nigerian Red Cross Society
                            </span>
                            <span className="text-[14px] text-sidebar-foreground/70 truncate">
                              Enterprise Asset Management
                            </span>
                          </div>
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Go to Dashboard</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSidebarWidth}
                    className={`h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 border border-sidebar-border hover:border-primary/50 ${toggleFeedback ? "bg-primary/20 scale-110 border-primary" : ""}`}
                    aria-label="Toggle sidebar width (Ctrl+B)"
                    title="Toggle sidebar width (Ctrl+B)"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-sidebar-foreground" />
                  </button>
                </div>
              </div>
            )}
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Search Bar */}
            {sidebarWidth > PRESET_WIDTHS.narrow && (
              <div className="px-3 py-2 border-b border-sidebar-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-[20px] w-[20px] text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-8 pr-3 text-[17px] bg-sidebar-accent/50 border border-sidebar-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            )}
            
            <SidebarGroupedNav
              location={location}
              setLocation={setLocation}
              sidebarWidth={sidebarWidth}
              searchQuery={searchQuery}
              userRole={user?.role}
              sidebarCounts={sidebarCountsQuery.data ?? undefined}
            />
          </SidebarContent>

          <SidebarFooter className="p-3 space-y-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="user-menu-trigger"
                  className={`flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sidebarWidth === PRESET_WIDTHS.narrow ? 'justify-center' : ''}`}
                >
                  <Avatar className="h-[47px] w-[47px] border shrink-0">
                    {user?.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt="" className="object-cover" />
                    ) : null}
                    <AvatarFallback className="text-[16px] font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {sidebarWidth > PRESET_WIDTHS.narrow && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate mt-1.5">
                        {user?.email || "-"}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={appPath("/dashboard-settings")} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation(appPath("/notification-preferences"))}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Notification Settings</span>
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
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors"
          onMouseDown={() => {
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="min-h-svh bg-background dark:bg-[#232323]">
        <InstallPWABanner />
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 dark:bg-[#232323]/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <GlobalSearch />
              <ThemeToggle />
              <NotificationCenter />
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
              <ThemeToggle className="text-[#1a2332] hover:bg-black/5 dark:text-[hsl(0_0%_95%)] dark:hover:bg-white/10" />
              <NotificationCenter triggerClassName="text-[#1a2332] hover:bg-black/5 dark:text-[hsl(0_0%_95%)] dark:hover:bg-white/10" />
            </div>
          </div>
        )}
        <main data-testid="app-page-main" className="flex-1 overflow-x-hidden p-3 sm:p-4">
          {children}
        </main>
        <Footer />
      </SidebarInset>
    </DashboardRolePreviewProvider>
  );
}
