import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

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

    // Call verification endpoint
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
            setLocation("/");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#1E3A8A] rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">NRCS</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === "verifying" && "Verifying..."}
            {status === "success" && "Success!"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription>
            Nigerian Red Cross Society
            <br />
            Enterprise Asset Management
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "verifying" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#1E3A8A]" />
              <p className="text-center text-gray-600">Verifying your magic link...</p>
            </div>
          )}

          {status === "success" && (
            <Alert>
              <AlertDescription className="text-center">{message}</AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertDescription className="text-center">{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
