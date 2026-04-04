import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#1E3A8A] rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">NRCS</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
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
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loginMutation.isPending}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Sending..." : "Send Magic Link"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link href="/signup" className="text-[#1E3A8A] hover:underline font-medium">
                Request Access
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t text-center text-xs text-gray-500">
            <p>We'll send a secure sign-in link to your email.</p>
            <p className="mt-1">No password required.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
