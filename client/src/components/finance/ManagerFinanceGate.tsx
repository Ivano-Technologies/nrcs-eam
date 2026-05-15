import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export function ManagerFinanceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const allowed = user?.role === "admin" || user?.role === "manager";
  if (allowed) return <>{children}</>;
  return (
    <div className="container mx-auto max-w-lg space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            Access restricted
          </CardTitle>
          <CardDescription>This section is available to managers and administrators only.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
