import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AuthBrandLogo,
  AuthFooterNote,
  AuthSubtitle,
  AuthTitle,
  authInputClass,
  authPrimaryButtonClass,
} from "@/components/auth/AuthPageShell";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { GlassCard } from "@/components/auth/GlassCard";
import { trpc } from "@/lib/trpc";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        setEmail("");
        setName("");
        setDesignation("");
        setDepartment("");
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

    if (!email || !name || !designation.trim() || !department.trim()) {
      setMessage({ type: "error", text: "Please fill in all fields" });
      return;
    }

    signupMutation.mutate({
      email,
      name,
      designation: designation.trim(),
      department: department.trim(),
    });
  };

  return (
    <AuthPageLayout>
      <GlassCard className="max-w-lg text-center">
        <AuthBrandLogo />
        <AuthTitle>Create account</AuthTitle>
        <AuthSubtitle>To access the NRCS EAM system</AuthSubtitle>

        <form onSubmit={handleSubmit} className="mt-8 w-full space-y-4 text-left">
          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"} className="text-left">
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-[15px] text-gray-800">
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
              className={authInputClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[15px] text-gray-800">
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
              className={authInputClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation" className="text-[15px] text-gray-800">
              Designation
            </Label>
            <Input
              id="designation"
              type="text"
              placeholder="e.g. Senior Officer"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              disabled={signupMutation.isPending}
              required
              className={authInputClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department" className="text-[15px] text-gray-800">
              Department
            </Label>
            <Input
              id="department"
              type="text"
              placeholder="e.g. Logistics"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={signupMutation.isPending}
              required
              className={authInputClass}
            />
          </div>

          <Button type="submit" className={authPrimaryButtonClass} disabled={signupMutation.isPending}>
            {signupMutation.isPending ? "Submitting..." : "Request Access"}
          </Button>

          <p className="pt-2 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#ef4444] hover:underline">
              Sign In
            </Link>
          </p>
        </form>

        <div className="mt-10 text-center text-xs leading-relaxed text-gray-500">
          <p>Your request will be reviewed by an administrator.</p>
          <p className="mt-1">You&apos;ll receive an email once approved.</p>
        </div>

        <AuthFooterNote>Authorized personnel only.</AuthFooterNote>
      </GlassCard>
    </AuthPageLayout>
  );
}
