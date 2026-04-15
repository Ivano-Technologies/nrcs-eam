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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loginMutation = trpc.auth.requestMagicLink.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.message });
      }
    },
    onError: (error: { message?: string }) => {
      setMessage({ type: "error", text: error.message || "Failed to send magic link" });
    },
  });

  const passwordLoginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      setLocation(appPath("/"));
    },
    onError: (error: { message?: string }) => {
      setMessage({
        type: "error",
        text: error.message || "Sign in failed",
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email.trim()) {
      setMessage({ type: "error", text: "Please enter your email" });
      return;
    }
    if (!password) {
      setMessage({ type: "error", text: "Please enter your password" });
      return;
    }

    passwordLoginMutation.mutate({ email: email.trim(), password });
  };

  const handleMagicLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email) {
      setMessage({ type: "error", text: "Please enter your email" });
      return;
    }

    loginMutation.mutate({ email: email.trim() });
  };

  const busy = loginMutation.isPending || passwordLoginMutation.isPending;

  return (
    <AuthPageLayout>
      <GlassCard className="text-center">
        <AuthBrandLogo />
        <AuthTitle className="text-[23.8px]">Log in to NRCS EAM</AuthTitle>

        <div className="mt-8 w-full space-y-6 text-left">
          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"} className="text-left">
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sign in with password</p>
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
                disabled={busy}
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
                disabled={busy}
                autoComplete="current-password"
                className={authInputClass}
              />
            </div>
            <Button
              type="submit"
              data-testid="login-password-submit"
              className={authPrimaryButtonClass}
              disabled={busy}
            >
              {passwordLoginMutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Or
          </p>

          <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sign in with email link</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              We&apos;ll send a one-time link to the address above (same email field).
            </p>
            <Button
              type="submit"
              data-testid="login-send-magic-link"
              variant="outline"
              className="w-full"
              disabled={busy}
            >
              {loginMutation.isPending ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>

          <p className="pt-2 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-[#ef4444] hover:underline">
              Request Access
            </Link>
          </p>
        </div>
      </GlassCard>
    </AuthPageLayout>
  );
}
