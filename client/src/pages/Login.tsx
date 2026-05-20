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
import { PasswordInputWithToggle } from "@/components/auth/PasswordInputWithToggle";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { appPath } from "@/lib/routes";
import { TRPCClientError } from "@trpc/client";

function isRetryableLoginError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) return false;
  const code = error.data?.code;
  return (
    code === "INTERNAL_SERVER_ERROR" ||
    code === "TIMEOUT" ||
    error.message.toLowerCase().includes("temporarily unavailable")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: async (data) => {
      let me = await utils.auth.me.fetch();
      if (!me) {
        await sleep(500);
        me = await utils.auth.me.fetch();
      }
      if (!me) {
        setErrorMessage(
          "Signed in but session could not be loaded. Please try again."
        );
        return;
      }
      if (data.mustChangePasswordOnLogin) {
        setLocation(`${appPath("/dashboard-settings")}?changePassword=required`);
        return;
      }
      setLocation(appPath("/"));
    },
  });

  const passwordResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      setResetMessage(data.message);
      setErrorMessage(null);
    },
    onError: (error: { message?: string }) => {
      setResetMessage(null);
      setErrorMessage(error.message || "Failed to send reset email");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your email");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password");
      return;
    }

    const credentials = { email: email.trim(), password };

    const runLogin = async (attempt: number) => {
      try {
        return await loginMutation.mutateAsync(credentials);
      } catch (error) {
        if (attempt === 0 && isRetryableLoginError(error)) {
          console.warn("[login] first attempt failed, retrying once", {
            code:
              error instanceof TRPCClientError ? error.data?.code : undefined,
            message: error instanceof Error ? error.message : String(error),
          });
          await sleep(1000);
          return runLogin(1);
        }
        throw error;
      }
    };

    try {
      await runLogin(0);
    } catch (error) {
      const message =
        error instanceof TRPCClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Sign in failed";
      setErrorMessage(message || "Sign in failed");
    }
  };

  const handlePasswordReset = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your email to request a password reset");
      return;
    }

    passwordResetMutation.mutate({ email: email.trim() });
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
          {resetMessage && !errorMessage && (
            <Alert className="text-left">
              <AlertDescription>{resetMessage}</AlertDescription>
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
              disabled={loginMutation.isPending || passwordResetMutation.isPending}
              autoComplete="email"
              required
              className={authInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[15px] text-gray-800 dark:text-gray-200">
              Password
            </Label>
            <PasswordInputWithToggle
              id="password"
              data-testid="login-password-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loginMutation.isPending}
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            data-testid="login-password-submit"
            className={authPrimaryButtonClass}
            disabled={loginMutation.isPending || passwordResetMutation.isPending}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
          <button
            type="button"
            data-testid="login-forgot-password"
            className="inline-flex w-full items-center justify-center gap-2 text-sm text-[#1E3A8A] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loginMutation.isPending || passwordResetMutation.isPending}
            onClick={handlePasswordReset}
          >
            {passwordResetMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending reset link...
              </>
            ) : (
              "Forgot password?"
            )}
          </button>

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
