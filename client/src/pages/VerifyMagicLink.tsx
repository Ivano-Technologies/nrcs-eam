import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { appPath } from "@/lib/routes";
import { AuthBrandLogo, AuthSubtitle, AuthTitle } from "@/components/auth/AuthPageShell";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { GlassCard } from "@/components/auth/GlassCard";
import { trpc } from "@/lib/trpc";

type OtpType = "email" | "magiclink" | "signup" | "recovery" | "invite";

function parseHashAccessTokens(): {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
} | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const p = new URLSearchParams(raw);
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  const exp = p.get("expires_in");
  return {
    access_token,
    refresh_token,
    expires_in: exp ? Number(exp) : undefined,
  };
}

export default function VerifyMagicLink() {
  const [, setLocation] = useLocation();
  const ran = useRef(false);
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  const setSession = trpc.auth.setSessionFromTokens.useMutation({
    onSuccess: () => {
      setStatus("success");
      setMessage("Successfully signed in! Redirecting...");
      setTimeout(() => setLocation(appPath("/")), 1500);
    },
    onError: (err) => {
      setStatus("error");
      setMessage(err.message || "Verification failed");
    },
  });

  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: () => {
      setStatus("success");
      setMessage("Successfully signed in! Redirecting...");
      setTimeout(() => setLocation(appPath("/")), 1500);
    },
    onError: (err) => {
      setStatus("error");
      setMessage(err.message || "Verification failed");
    },
  });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const fromHash = parseHashAccessTokens();
    if (fromHash) {
      setSession.mutate(fromHash);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const email = params.get("email")?.trim();
    const token =
      params.get("token")?.trim() ||
      params.get("token_hash")?.trim() ||
      params.get("otp")?.trim();
    const typeRaw = params.get("type")?.trim().toLowerCase();
    const typeMap: Record<string, OtpType> = {
      email: "email",
      magiclink: "magiclink",
      magic_link: "magiclink",
      signup: "signup",
      recovery: "recovery",
      invite: "invite",
    };
    const type: OtpType = typeRaw
      ? typeMap[typeRaw] ?? "email"
      : "email";

    if (email && token) {
      verifyOtp.mutate({ email, token, type });
      return;
    }

    setStatus("error");
    setMessage("Invalid or missing verification parameters. Open the link from your email again.");
  }, []);

  const title =
    status === "verifying" ? "Verifying..." : status === "success" ? "Success!" : "Verification Failed";

  return (
    <AuthPageLayout>
      <GlassCard className="text-center">
        <AuthBrandLogo />
        <AuthTitle>{title}</AuthTitle>
        <AuthSubtitle className="text-center">
          Nigerian Red Cross Society
          <br />
          Enterprise Asset Management
        </AuthSubtitle>

        <div className="mt-6 text-left">
          {status === "verifying" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#1E3A8A]" />
              <p className="text-center text-gray-600">Verifying your magic link...</p>
            </div>
          )}

          {status === "success" && (
            <Alert>
              <AlertDescription className="text-center text-gray-800">{message}</AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertDescription className="text-center">{message}</AlertDescription>
            </Alert>
          )}
        </div>
      </GlassCard>
    </AuthPageLayout>
  );
}
