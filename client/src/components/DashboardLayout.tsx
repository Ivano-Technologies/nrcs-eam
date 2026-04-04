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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, Users, UserPlus, Package, Wrench, Calendar, TrendingUp, FileText, MapPin, Building2, DollarSign, Map, Settings, Download, Maximize2, Mail, Scan, Search, AlertTriangle, BarChart3, History } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { NotificationCenter } from "./NotificationCenter";
import Footer from "./Footer";

const allMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", adminOnly: false, sortOrder: 0 },
  { icon: Settings, label: "Dashboard Settings", path: "/dashboard-settings", adminOnly: false },
  { icon: Package, label: "Assets", path: "/assets", adminOnly: false },
  { icon: Map, label: "Asset Map", path: "/asset-map", adminOnly: false },
  { icon: Scan, label: "Asset Scanner", path: "/scanner", adminOnly: false },
  { icon: FileText, label: "Compliance", path: "/compliance", adminOnly: false },
  { icon: Mail, label: "Email Notifications", path: "/email-notifications", adminOnly: true },
  { icon: DollarSign, label: "Financial", path: "/financial", adminOnly: false },
  { icon: TrendingUp, label: "Inventory", path: "/inventory", adminOnly: false },
  { icon: Calendar, label: "Maintenance", path: "/maintenance", adminOnly: false },
  { icon: DollarSign, label: "QuickBooks", path: "/quickbooks", adminOnly: true },
  { icon: FileText, label: "Reports", path: "/reports", adminOnly: false },
  { icon: Calendar, label: "Report Scheduling", path: "/report-scheduling", adminOnly: false },
  { icon: MapPin, label: "Sites", path: "/sites", adminOnly: false },
  { icon: Users, label: "Users", path: "/users", adminOnly: true },
  { icon: UserPlus, label: "Pending Users", path: "/pending-users", adminOnly: true },
  { icon: Building2, label: "Vendors", path: "/vendors", adminOnly: false },
  { icon: Wrench, label: "Work Orders", path: "/work-orders", adminOnly: false },
  { icon: FileText, label: "Work Order Templates", path: "/work-order-templates", adminOnly: false },
  { icon: AlertTriangle, label: "Warranty Alerts", path: "/warranty-alerts", adminOnly: false },
  { icon: BarChart3, label: "Cost Analytics", path: "/cost-analytics", adminOnly: false },
  { icon: History, label: "Audit Trail", path: "/audit-trail", adminOnly: true },
  { icon: History, label: "Activity Log", path: "/activity-log", adminOnly: false },
];

const getMenuItems = (userRole?: string) => {
  const filtered = allMenuItems.filter(item => 
    !item.adminOnly || userRole === 'admin'
  );
  
  // Sort alphabetically, but keep Dashboard first
  return filtered.sort((a, b) => {
    if (a.sortOrder !== undefined) return -1;
    if (b.sortOrder !== undefined) return 1;
    return a.label.localeCompare(b.label);
  });
};

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
  const { loading, user } = useAuth();
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

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-white via-blue-50 to-red-50">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full bg-white rounded-2xl shadow-2xl border border-border">
          <div className="flex flex-col items-center gap-6">
            <img 
              src="/nrcs-logo.png" 
              alt="Nigerian Red Cross Society" 
              className="h-24 w-24"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight mb-2">
                NRCS Asset Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Nigerian Red Cross Society
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sign in to access the Enterprise Asset Management System
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-primary hover:bg-primary/90"
          >
            Sign In
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Authorized personnel only
          </p>
        </div>
      </div>
    );
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
    if (user && !user.hasCompletedOnboarding && location !== '/welcome') {
      setLocation('/welcome');
    }
  }, [user, location, setLocation]);
  const { state } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = getMenuItems(user?.role);
  const activeMenuItem = menuItems.find((item: any) => item.path === location);
  const isMobile = useIsMobile();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [toggleFeedback, setToggleFeedback] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMenuItems = menuItems.filter((item: any) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    setDeferredPrompt(null);
  };



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
                    <span className="font-bold text-[18px] text-sidebar-foreground truncate">
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
            
            <SidebarMenu className="px-2 py-1">
              {filteredMenuItems.map((item: any) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal ${sidebarWidth === PRESET_WIDTHS.narrow ? 'justify-center' : ''}`}
                    >
                      <item.icon
                        className={`h-[20px] w-[20px] ${isActive ? "text-primary" : ""}`}
                      />
                      {sidebarWidth > PRESET_WIDTHS.narrow && <span className="text-[17px]">{item.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 space-y-2">
            {showInstallPrompt && (
              <Button 
                onClick={handleInstallClick}
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs h-9 border-primary/30 hover:bg-primary/10"
              >
                <Download className="h-[18px] w-[18px]" />
                {sidebarWidth > PRESET_WIDTHS.narrow && <span className="text-[16px]">Install App</span>}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sidebarWidth === PRESET_WIDTHS.narrow ? 'justify-center' : ''}`}>
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
                  onClick={() => setLocation("/notification-preferences")}
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

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
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
            <NotificationCenter />
          </div>
        )}
        {!isMobile && (
          <div className="flex border-b h-14 items-center justify-end bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <NotificationCenter />
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
        <Footer />
      </SidebarInset>
    </>
  );
}
