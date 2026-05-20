import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordInputWithToggle } from "@/components/auth/PasswordInputWithToggle";
import { PasswordStrengthBar } from "@/components/auth/PasswordStrengthBar";
import { Label } from "@/components/ui/label";
import {
  AuthBrandLogo,
  AuthSubtitle,
  AuthTitle,
  authPrimaryButtonClass,
} from "@/components/auth/AuthPageShell";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { GlassCard } from "@/components/auth/GlassCard";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RecoveryState = "checking" | "ready" | "invalid" | "success";

function readHashParams() {
  const raw = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(raw);
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<RecoveryState>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationMessage = useMemo(() => {
    if (!newPassword) return null;
    if (newPassword.length < 8) return "Password must be at least 8 characters.";
    if (confirmPassword && newPassword !== confirmPassword) return "Passwords do not match.";
    return null;
  }, [newPassword, confirmPassword]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = readHashParams();
      const hasRecoveryTokens = Boolean(hash.get("access_token") && hash.get("refresh_token"));
      const code = query.get("code");

      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY") {
          setState("ready");
          setErrorMessage(null);
        }
      });

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (active) setState("ready");
          return () => authListener.subscription.unsubscribe();
        }

        if (hasRecoveryTokens) {
          const accessToken = hash.get("access_token")!;
          const refreshToken = hash.get("refresh_token")!;
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (active) setState("ready");
          return () => authListener.subscription.unsubscribe();
        }

        if (active) setState("invalid");
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Invalid or expired reset link.";
        setErrorMessage(message);
        setState("invalid");
      }

      return () => authListener.subscription.unsubscribe();
    };

    const cleanupPromise = init();
    return () => {
      active = false;
      void cleanupPromise;
    };
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setState("success");
      setTimeout(() => setLocation("/login?reset=success"), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update password.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout>
      <GlassCard className="text-center">
        <AuthBrandLogo />
        <AuthTitle>Reset Password</AuthTitle>
        <AuthSubtitle className="text-center">
          Nigerian Red Cross Society
          <br />
          Enterprise Asset Management
        </AuthSubtitle>

        {state === "checking" && (
          <p className="mt-6 text-sm text-gray-600">Validating your recovery link...</p>
        )}

        {state === "invalid" && (
          <Alert variant="destructive" className="mt-6 text-left">
            <AlertDescription>
              {errorMessage ?? "This link has expired or is invalid. Request a new password reset."}
            </AlertDescription>
          </Alert>
        )}

        {state === "ready" && (
          <form onSubmit={onSubmit} className="mt-6 space-y-4 text-left">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInputWithToggle
                id="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <PasswordStrengthBar password={newPassword} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInputWithToggle
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {validationMessage && (
              <Alert variant="destructive">
                <AlertDescription>{validationMessage}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className={authPrimaryButtonClass}
              disabled={isSubmitting || Boolean(validationMessage)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Set new password"
              )}
            </Button>
          </form>
        )}

        {state === "success" && (
          <Alert className="mt-6 text-left">
            <AlertDescription>
              Password updated. You can now log in.
              {" "}
              <Link href="/login" className="font-medium underline">
                Go to login
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}
      </GlassCard>
    </AuthPageLayout>
  );
}
