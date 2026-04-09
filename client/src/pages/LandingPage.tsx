import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AuthBrandLogo,
  AuthFooterNote,
  AuthHeroLayout,
  AuthSubtitle,
  AuthTitle,
  authPrimaryButtonClass,
} from "@/components/auth/AuthPageShell";
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
      <AuthHeroLayout>
        <p className="text-base text-[#6b7280]">Loading…</p>
      </AuthHeroLayout>
    );
  }

  if (user) {
    return (
      <AuthHeroLayout>
        <AuthBrandLogo />
        <AuthTitle>Nigerian Red Cross Society</AuthTitle>
        <AuthSubtitle>Opening your dashboard…</AuthSubtitle>
        <Button asChild className={authPrimaryButtonClass}>
          <Link href={appPath("/")}>Go to Dashboard</Link>
        </Button>
      </AuthHeroLayout>
    );
  }

  return (
    <AuthHeroLayout>
      <AuthBrandLogo />
      <AuthTitle>Nigerian Red Cross Society</AuthTitle>
      <AuthSubtitle className="text-[1.2rem]">
        Enterprise Asset Management System
      </AuthSubtitle>
      <Button asChild className={authPrimaryButtonClass}>
        <Link href="/login">Sign In</Link>
      </Button>
      <AuthFooterNote>Authorized personnel only.</AuthFooterNote>
    </AuthHeroLayout>
  );
}
