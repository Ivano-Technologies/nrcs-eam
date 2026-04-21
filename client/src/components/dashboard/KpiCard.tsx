import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type KpiTone = "red" | "blue" | "purple" | "orange" | "green";

const toneClassMap: Record<KpiTone, string> = {
  red: "bg-gradient-to-br from-red-600 to-red-700",
  blue: "bg-gradient-to-br from-blue-500 to-blue-700",
  purple: "bg-gradient-to-br from-purple-500 to-purple-600",
  orange: "bg-gradient-to-br from-orange-500 to-orange-600",
  green: "bg-gradient-to-br from-green-500 to-green-700",
};

type Props = {
  label: string;
  value: string | number;
  sub?: ReactNode;
  icon: LucideIcon;
  tone: KpiTone;
  delta?: string;
  deltaDirection?: "up" | "down" | "flat";
};

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  delta,
  deltaDirection = "flat",
}: Props) {
  return (
    <Card className="border-l-4 border-l-primary/20 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground">{label}</CardTitle>
        <div className={cn("p-2.5 rounded-xl shadow-sm", toneClassMap[tone])}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-2xl font-bold">{value}</div>
        {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
        {delta && deltaDirection !== "flat" ? (
          <span
            className={cn(
              "absolute right-0 bottom-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
              deltaDirection === "up" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}
          >
            {deltaDirection === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
