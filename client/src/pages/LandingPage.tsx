import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AuthBrandLogo,
  AuthFooterNote,
  AuthSubtitle,
  AuthTitle,
  authPrimaryButtonClass,
} from "@/components/auth/AuthPageShell";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { GlassCard } from "@/components/auth/GlassCard";
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
      <AuthPageLayout>
        <GlassCard className="text-center">
          <p className="text-base text-gray-600 dark:text-gray-400">Loading…</p>
        </GlassCard>
      </AuthPageLayout>
    );
  }

  if (user) {
    return (
      <AuthPageLayout>
        <GlassCard className="text-center">
          <AuthBrandLogo />
          <AuthTitle className="text-[23.8px]">Nigerian Red Cross Society</AuthTitle>
          <AuthSubtitle>Opening your dashboard…</AuthSubtitle>
          <Button asChild className={authPrimaryButtonClass}>
            <Link href={appPath("/")}>Go to Dashboard</Link>
          </Button>
        </GlassCard>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <GlassCard className="text-center">
        <AuthBrandLogo />
        <AuthTitle className="text-[23.8px]">Nigerian Red Cross Society</AuthTitle>
        <AuthSubtitle className="text-[1.2rem]">
          Enterprise Asset Management System
        </AuthSubtitle>
        <Button asChild className={authPrimaryButtonClass}>
          <Link href="/login">Sign In</Link>
        </Button>
        <AuthFooterNote>Authorized personnel only.</AuthFooterNote>
      </GlassCard>
    </AuthPageLayout>
  );
}
