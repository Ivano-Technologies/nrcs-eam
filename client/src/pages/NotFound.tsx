import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { GlassCard } from "@/components/auth/GlassCard";
import { AuthBrandLogo, AuthSubtitle, AuthTitle, authPrimaryButtonClass } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";
import { useLocation } from "wouter";

const NOT_FOUND_TITLE = "Page not found";
const NOT_FOUND_BODY = "The page you are looking for does not exist or has moved.";
const NOT_FOUND_ACTION = "Back to home";

function NotFoundCard({ homePath, inApp = false }: { homePath: string; inApp?: boolean }) {
  const [, setLocation] = useLocation();
  const content = (
    <>
      <AuthBrandLogo />
      <p className="text-sm font-semibold uppercase tracking-wide text-[#C8102E] dark:text-[#F87171]">404</p>
      <AuthTitle>{NOT_FOUND_TITLE}</AuthTitle>
      <AuthSubtitle className="text-center">{NOT_FOUND_BODY}</AuthSubtitle>
      <Button type="button" onClick={() => setLocation(homePath)} className={cn(authPrimaryButtonClass)}>
        <Home className="mr-2 h-4 w-4" aria-hidden />
        {NOT_FOUND_ACTION}
      </Button>
    </>
  );
  if (inApp) {
    // Inside the app shell the glass card has nothing behind it to blur, so use the themed app card
    // (bg-card and border follow light and dark) with the same brand red action.
    return (
      <div
        className="mx-auto w-full max-w-md rounded-3xl border bg-card p-8 text-center text-card-foreground shadow-sm md:p-10"
        data-testid="not-found"
        data-variant="app"
      >
        {content}
      </div>
    );
  }
  return (
    <GlassCard className="text-center" data-testid="not-found">
      {content}
    </GlassCard>
  );
}

/**
 * On brand 404. Public routes get the auth page layout (gradient, theme toggle, credit);
 * inside the signed in app it renders just the card within the app shell.
 */
export default function NotFound() {
  const [location] = useLocation();
  const inApp = location === "/app" || location.startsWith("/app/");

  if (inApp) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-8">
        <NotFoundCard homePath="/app" inApp />
      </div>
    );
  }

  return (
    <AuthPageLayout>
      <NotFoundCard homePath="/" />
    </AuthPageLayout>
  );
}
