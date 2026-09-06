import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedAppSection from "@/components/ProtectedAppSection";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_ROUTE_PATTERN } from "@/lib/routes";
import { lazy, Suspense, useEffect } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Route, Switch } from "wouter";
import Signup from "./pages/Signup";
import Login from "./pages/Login";

const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));

function PublicRouteFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PublicRouteFallback />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/legal/terms" component={TermsOfService} />
        <Route path="/legal/privacy" component={PrivacyPolicy} />
        <Route path="/404" component={NotFound} />
        <Route path={APP_ROUTE_PATTERN} component={ProtectedAppSection} />
        <Route path="/" component={LandingPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function ThemeMigration() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (theme === "system" || theme == null) setTheme("light");
  }, [theme, setTheme]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="nrcs-theme"
      >
        <ThemeMigration />
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
