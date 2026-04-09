import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import VerifyMagicLink from "@/pages/VerifyMagicLink";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import LandingPage from "@/pages/LandingPage";
import ProtectedAppSection from "@/components/ProtectedAppSection";
import { APP_ROUTE_PATTERN } from "@/lib/routes";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/auth/verify" component={VerifyMagicLink} />
      <Route path="/legal/terms" component={TermsOfService} />
      <Route path="/legal/privacy" component={PrivacyPolicy} />
      <Route path="/404" component={NotFound} />
      <Route path={APP_ROUTE_PATTERN} component={ProtectedAppSection} />
      <Route path="/" component={LandingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="nrcs-theme"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
