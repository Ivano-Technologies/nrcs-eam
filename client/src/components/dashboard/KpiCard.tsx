import { Card, CardContent } from "@/components/ui/card";
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

type DeltaDirection = "up" | "down" | "flat";

type Props = {
  label: string;
  value: string | number;
  sub?: ReactNode;
  icon: LucideIcon;
  tone: KpiTone;
  delta?: string;
  deltaDirection?: DeltaDirection;
};

function DeltaPill({
  delta,
  deltaDirection,
}: {
  delta: string;
  deltaDirection: Exclude<DeltaDirection, "flat">;
}) {
  const isGood = deltaDirection === "up";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        isGood ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {isGood ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  delta,
  deltaDirection = "flat",
}: Props) {
  const showPill = Boolean(delta) && deltaDirection !== "flat";

  return (
    <Card className="flex h-full min-h-[168px] flex-col border-l-4 border-l-primary/20 bg-gradient-to-br from-white to-gray-50 shadow-sm transition-all duration-200 hover:shadow-lg dark:from-card dark:to-card">
      <CardContent className="flex flex-1 flex-col px-5 pb-4 pt-5">
        <header className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug text-foreground">{label}</span>
          <div className={cn("shrink-0 rounded-xl p-2.5 shadow-sm", toneClassMap[tone])}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </header>

        <div className="mt-3 min-w-0 break-words text-3xl font-bold tracking-tight text-foreground">{value}</div>

        <footer className="mt-auto flex items-center justify-between gap-2 pt-4">
          {sub ? (
            <span className="min-w-0 text-sm text-muted-foreground">{sub}</span>
          ) : (
            <span className="text-sm text-muted-foreground select-none" aria-hidden>
              {"\u00a0"}
            </span>
          )}
          {showPill ? <DeltaPill delta={delta!} deltaDirection={deltaDirection} /> : null}
        </footer>
      </CardContent>
    </Card>
  );
}
