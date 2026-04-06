import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { appPath } from "@/lib/routes";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation(appPath("/"), { replace: true });
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-blue-50 to-red-50">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-blue-50 to-red-50 px-4">
        <div className="max-w-lg text-center space-y-6">
          <p className="text-muted-foreground">Opening your dashboard…</p>
          <Button asChild size="lg" className="shadow-lg">
            <Link href={appPath("/")}>Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-blue-50 to-red-50 px-4">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          NRCS Asset Management
        </h1>
        <p className="text-muted-foreground text-lg">
          Enterprise Asset Management System — Nigerian Red Cross Society
        </p>
        <Button asChild size="lg" className="shadow-lg">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
