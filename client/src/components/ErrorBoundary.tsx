import { AuthBrandLogo, authPrimaryButtonClass } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { Home, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

export const ERROR_PAGE_TITLE = "Something went wrong";
export const ERROR_PAGE_BODY = "We hit a problem loading this page. Please try again.";

interface Props {
  children: ReactNode;
  /**
   * "page" fills the screen (used at the app root). "section" sits inside the app shell so the
   * sidebar and header stay usable.
   */
  variant?: "page" | "section";
  /** Change this (for example the current path) to clear the error when the user navigates. */
  resetKey?: string;
}

interface State {
  hasError: boolean;
}

function homePath(): string {
  if (typeof window === "undefined") return "/";
  const p = window.location.pathname;
  return p === "/app" || p.startsWith("/app/") ? "/app" : "/";
}

/**
 * IVA-189: friendly error page. Never shows error.message or a stack trace; the raw error is
 * logged with console.error and sent to PostHog (or Sentry if present) instead.
 */
export function ErrorFallback({
  onRetry,
  variant = "page",
}: {
  onRetry: () => void;
  variant?: "page" | "section";
}) {
  const card = (
    <div
      role="alert"
      data-testid="error-fallback"
      className="mx-auto flex w-full max-w-md flex-col items-center rounded-xl border bg-card p-8 text-center text-card-foreground shadow-sm md:p-10"
    >
      <AuthBrandLogo />
      <h1 className="text-2xl font-bold leading-tight tracking-tight">{ERROR_PAGE_TITLE}</h1>
      <p className="mt-3 text-base text-muted-foreground">{ERROR_PAGE_BODY}</p>
      <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button type="button" onClick={onRetry} className={cn(authPrimaryButtonClass, "sm:w-auto sm:px-6")}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          Try again
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 sm:px-6"
          onClick={() => window.location.assign(homePath())}
        >
          <Home className="mr-2 h-4 w-4" aria-hidden />
          Go home
        </Button>
      </div>
    </div>
  );
  if (variant === "section") {
    return <div className="flex min-h-[60vh] items-center justify-center py-8">{card}</div>;
  }
  return <div className="flex min-h-screen items-center justify-center bg-background p-6">{card}</div>;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, "ErrorBoundary");
    if (errorInfo?.componentStack) console.error("[ErrorBoundary] component stack", errorInfo.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.retry} variant={this.props.variant ?? "page"} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
