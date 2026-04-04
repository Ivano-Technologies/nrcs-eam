import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#1E3A8A] rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">NR</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Nigerian Red Cross Society
            <br />
            Enterprise Asset Management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <Alert variant={message.type === "error" ? "destructive" : "default"}>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={signupMutation.isPending}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={signupMutation.isPending}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
              disabled={signupMutation.isPending}
            >
              {signupMutation.isPending ? "Submitting..." : "Request Access"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-[#1E3A8A] hover:underline font-medium">
                Sign In
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t text-center text-xs text-gray-500">
            <p>Your request will be reviewed by an administrator.</p>
            <p className="mt-1">You'll receive an email once approved.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
