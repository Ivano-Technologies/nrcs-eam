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
  const [magicLinkMessage, setMagicLinkMessage] = useState<string | null>(null);

  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      setLocation(appPath("/"));
    },
    onError: (error: { message?: string }) => {
      setErrorMessage(error.message || "Sign in failed");
    },
  });

  const magicLinkMutation = trpc.auth.requestMagicLink.useMutation({
    onSuccess: (data) => {
      setMagicLinkMessage(
        data.success
          ? data.message
          : data.message || "Could not send magic link"
      );
      if (!data.success) {
        setErrorMessage(data.message);
      } else {
        setErrorMessage(null);
      }
    },
    onError: (error: { message?: string }) => {
      setMagicLinkMessage(null);
      setErrorMessage(error.message || "Failed to send magic link");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMagicLinkMessage(null);

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

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMagicLinkMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your email to receive a magic link");
      return;
    }

    magicLinkMutation.mutate({ email: email.trim() });
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
          {magicLinkMessage && !errorMessage && (
            <Alert className="text-left">
              <AlertDescription>{magicLinkMessage}</AlertDescription>
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
              disabled={loginMutation.isPending || magicLinkMutation.isPending}
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
            disabled={loginMutation.isPending || magicLinkMutation.isPending}
          >
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500 dark:bg-gray-950">Or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A]/5"
            data-testid="login-magic-link-submit"
            disabled={loginMutation.isPending || magicLinkMutation.isPending}
            onClick={handleMagicLink}
          >
            {magicLinkMutation.isPending ? "Sending link…" : "Email me a magic link"}
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
