import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { LogOut, Settings, Maximize2, Search } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { NotificationCenter } from "./NotificationCenter";
import Footer from "./Footer";
import { ThemeToggle } from "./ui/ThemeToggle";
import { SidebarGroupedNav } from "./SidebarGroupedNav";
import { flattenNavItems } from "@/config/appNav";

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
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          className="border-r-0"
        >
          <SidebarHeader className="h-20 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-3 transition-all w-full">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img 
                  src="/nrcs-logo.png" 
                  alt="Nigerian Red Cross Society" 
                  className="h-12 w-12 shrink-0"
                />
                {sidebarWidth > PRESET_WIDTHS.narrow && (
                  <div className="flex flex-col min-w-0">
                    <span
                      className="font-bold text-[18px] text-sidebar-foreground truncate"
                      data-testid="sidebar-org-name"
                    >
                      Nigerian Red Cross Society
                    </span>
                    <span className="text-[16px] text-sidebar-foreground/70 truncate">
                      Enterprise Asset Management
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSidebarWidth}
                  className={`h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 border border-sidebar-border hover:border-primary/50 ${toggleFeedback ? 'bg-primary/20 scale-110 border-primary' : ''}`}
                  aria-label="Toggle sidebar width (Ctrl+B)"
                  title="Toggle sidebar width (Ctrl+B)"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-sidebar-foreground" />
                </button>
              </div>
            </div>
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
                    <AvatarFallback className="text-[16px] font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {sidebarWidth > PRESET_WIDTHS.narrow && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[18px] font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <p className="text-[16px] text-muted-foreground truncate mt-1.5">
                        {user?.email || "-"}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <NotificationCenter />
            </div>
          </div>
        )}
        {!isMobile && (
          <div className="flex border-b h-14 items-center justify-end gap-2 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 dark:bg-[#232323]/95">
            <ThemeToggle />
            <NotificationCenter />
          </div>
        )}
        <main data-testid="app-page-main" className="flex-1 p-4">
          {children}
        </main>
        <Footer />
      </SidebarInset>
    </>
  );
}
