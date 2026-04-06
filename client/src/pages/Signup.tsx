import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AuthBrandLogo,
  AuthFooterNote,
  AuthHeroLayout,
  AuthSubtitle,
  AuthTitle,
  authPrimaryButtonClass,
} from "@/components/auth/AuthPageShell";
import { trpc } from "@/lib/trpc";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setEmail("");
        setName("");
      } else {
        setMessage({ type: "error", text: data.message });
      }
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message || "Signup failed. Please try again." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !name) {
      setMessage({ type: "error", text: "Please fill in all fields" });
      return;
    }

    signupMutation.mutate({ email, name });
  };

  return (
    <AuthHeroLayout>
      <AuthBrandLogo />
      <AuthTitle>Create your account</AuthTitle>
      <AuthSubtitle>Access the NRCS asset management system</AuthSubtitle>

      <form onSubmit={handleSubmit} className="mt-8 w-full space-y-4 text-left">
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"} className="text-left">
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-[15px] text-neutral-700">
            Full Name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={signupMutation.isPending}
            required
            className="h-12 rounded-[10px] text-[15px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-[15px] text-neutral-700">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={signupMutation.isPending}
            required
            className="h-12 rounded-[10px] text-[15px]"
          />
        </div>

        <Button type="submit" className={authPrimaryButtonClass} disabled={signupMutation.isPending}>
          {signupMutation.isPending ? "Submitting..." : "Request Access"}
        </Button>

        <p className="pt-2 text-center text-sm text-[#6b7280]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#ef4444] hover:underline">
            Sign In
          </Link>
        </p>
      </form>

      <div className="mt-10 text-center text-xs leading-relaxed text-[#9ca3af]">
        <p>Your request will be reviewed by an administrator.</p>
        <p className="mt-1">You&apos;ll receive an email once approved.</p>
      </div>

      <AuthFooterNote>Authorized personnel only.</AuthFooterNote>
    </AuthHeroLayout>
  );
}
