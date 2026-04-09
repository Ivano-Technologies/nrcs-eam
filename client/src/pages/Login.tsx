import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AuthBrandLogo,
  AuthHeroLayout,
  AuthTitle,
  authPrimaryButtonClass,
} from "@/components/auth/AuthPageShell";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loginMutation = trpc.auth.requestMagicLink.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.message });
      }
    },
    onError: (error: any) => {
      setMessage({ type: "error", text: error.message || "Failed to send magic link" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email) {
      setMessage({ type: "error", text: "Please enter your email" });
      return;
    }

    loginMutation.mutate({ email });
  };

  return (
    <AuthHeroLayout>
      <AuthBrandLogo />
      <AuthTitle>Log in to NRCS EAM</AuthTitle>

      <form onSubmit={handleSubmit} className="mt-8 w-full space-y-4 text-left">
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"} className="text-left">
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-[15px] text-neutral-700">
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
            required
            className="h-12 rounded-[10px] text-[15px]"
          />
        </div>

        <Button
          type="submit"
          data-testid="login-send-magic-link"
          className={authPrimaryButtonClass}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "Sending..." : "Send Magic Link"}
        </Button>

        <p className="pt-2 text-center text-sm text-[#6b7280]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-[#ef4444] hover:underline">
            Request Access
          </Link>
        </p>
      </form>
    </AuthHeroLayout>
  );
}
