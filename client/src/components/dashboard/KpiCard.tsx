import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type KpiTone = "red" | "blue" | "purple" | "orange" | "green";

const toneClassMap: Record<KpiTone, string> = {
  red: "border-l-[#EE1C25]",
  blue: "border-l-[#1a2332]",
  purple: "border-l-[#1a2332]",
  orange: "border-l-[#EE1C25]",
  green: "border-l-[#1a2332]",
};

const iconToneClassMap: Record<KpiTone, string> = {
  red: "bg-[rgba(238,28,37,0.1)] text-[#EE1C25]",
  blue: "bg-[rgba(26,35,50,0.08)] text-[#1a2332]",
  purple: "bg-[rgba(26,35,50,0.08)] text-[#1a2332]",
  orange: "bg-[rgba(238,28,37,0.1)] text-[#EE1C25]",
  green: "bg-[rgba(26,35,50,0.08)] text-[#1a2332]",
};

type DeltaDirection = "up" | "down" | "flat";
type GoodWhen = "up" | "down";

type Props = {
  label: string;
  value: string | number;
  sub?: ReactNode;
  icon: LucideIcon;
  tone: KpiTone;
  delta?: string;
  deltaDirection?: DeltaDirection;
  /** Whether an increase ("up") or decrease ("down") in the metric is desirable. */
  goodWhen?: GoodWhen;
  /** Stable hook for E2E (dashboard KPI values). */
  valueTestId?: string;
};

function DeltaPill({
  delta,
  deltaDirection,
  goodWhen,
}: {
  delta: string;
  deltaDirection: Exclude<DeltaDirection, "flat">;
  goodWhen: GoodWhen;
}) {
  const isGood = deltaDirection === goodWhen;
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
  goodWhen = "up",
  valueTestId,
}: Props) {
  const showPill = Boolean(delta) && deltaDirection !== "flat";

  return (
    <Card
      className={cn(
        "dashboard-card flex h-full min-h-[168px] flex-col border-l-[3px] transition-shadow duration-150",
        toneClassMap[tone]
      )}
    >
      <CardContent className="flex flex-1 flex-col px-5 pb-4 pt-5">
        <header className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug text-[#1a2332]">{label}</span>
          <div className={cn("shrink-0 rounded-xl p-2.5", iconToneClassMap[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </header>

        <div
          className="mt-3 min-w-0 whitespace-nowrap text-[2rem] font-bold leading-snug tracking-tight tabular-nums text-[#1a2332]"
          data-testid={valueTestId}
        >
          {value}
        </div>

        <footer className="mt-auto flex items-center justify-between gap-2 pt-4">
          {sub ? (
            <span className="min-w-0 text-sm text-muted-foreground">{sub}</span>
          ) : (
            <span className="text-sm text-muted-foreground select-none" aria-hidden>
              {"\u00a0"}
            </span>
          )}
          {showPill ? <DeltaPill delta={delta!} deltaDirection={deltaDirection} goodWhen={goodWhen} /> : null}
        </footer>
      </CardContent>
    </Card>
  );
}
