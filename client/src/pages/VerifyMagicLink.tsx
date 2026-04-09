import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { appPath } from "@/lib/routes";
import { AuthBrandLogo, AuthSubtitle, AuthTitle } from "@/components/auth/AuthPageShell";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { GlassCard } from "@/components/auth/GlassCard";

export default function VerifyMagicLink() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token");
      return;
    }

    fetch(`/api/auth/verify-magic-link?token=${token}`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setMessage("Successfully signed in! Redirecting...");
          setTimeout(() => {
            setLocation(appPath("/"));
          }, 2000);
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Failed to verify magic link. Please try again.");
      });
  }, [setLocation]);

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
