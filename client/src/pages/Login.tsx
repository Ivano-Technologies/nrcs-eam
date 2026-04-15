import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AuthBrandLogo,
  AuthTitle,
  authInputClass,
  authPrimaryButtonClass,
} from "@/components/auth/AuthPageShell";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { GlassCard } from "@/components/auth/GlassCard";
import { trpc } from "@/lib/trpc";
import { appPath } from "@/lib/routes";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      setLocation(appPath("/"));
    },
    onError: (error: { message?: string }) => {
      setErrorMessage(error.message || "Sign in failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your email");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password");
      return;
    }

    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <AuthPageLayout>
      <GlassCard className="text-center">
        <AuthBrandLogo />
        <AuthTitle className="text-[23.8px]">Log in to NRCS EAM</AuthTitle>

        <form onSubmit={handleSubmit} className="mt-8 w-full space-y-4 text-left">
          {errorMessage && (
            <Alert variant="destructive" className="text-left">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[15px] text-gray-800 dark:text-gray-200">
              Email Address
            </Label>
            <Input
              id="email"
              data-testid="login-email-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loginMutation.isPending}
              autoComplete="email"
              required
              className={authInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[15px] text-gray-800 dark:text-gray-200">
              Password
            </Label>
            <Input
              id="password"
              data-testid="login-password-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loginMutation.isPending}
              autoComplete="current-password"
              className={authInputClass}
            />
          </div>
          <Button
            type="submit"
            data-testid="login-password-submit"
            className={authPrimaryButtonClass}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>

          <p className="pt-2 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-[#ef4444] hover:underline">
              Request Access
            </Link>
          </p>
        </form>
      </GlassCard>
    </AuthPageLayout>
  );
}
