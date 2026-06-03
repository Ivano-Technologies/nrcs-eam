import { Card, CardContent } from "@/components/ui/card";
import { KPI_VALUE_CLASS } from "@/lib/kpiTypography";
import { cn } from "@/lib/utils";
import { ChevronRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

type KpiTone = "red" | "blue" | "purple" | "orange" | "green";

const iconToneClassMap: Record<KpiTone, string> = {
  red: "text-[#EE1C25] dark:text-[hsl(0_0%_95%)]",
  blue: "text-[#1a2332] dark:text-[hsl(0_0%_95%)]",
  purple: "text-[#1a2332] dark:text-[hsl(0_0%_95%)]",
  orange: "text-[#EE1C25] dark:text-[hsl(0_0%_95%)]",
  green: "text-[#1a2332] dark:text-[hsl(0_0%_95%)]",
};

type DeltaDirection = "up" | "down" | "flat";
type GoodWhen = "up" | "down";

type Props = {
  label: string;
  value: string | number;
  sub?: ReactNode;
  icon: LucideIcon;
  tone: KpiTone;
  delta?: string | number;
  deltaDirection?: DeltaDirection;
  goodWhen?: GoodWhen;
  valueTestId?: string;
  href?: string;
};

function DeltaPill({
  delta,
  deltaDirection,
  goodWhen,
}: {
  delta: string | number;
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
      {String(delta)}
    </span>
  );
}

function KpiCardInner({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  delta,
  deltaDirection = "flat",
  goodWhen = "up",
  valueTestId,
  interactive,
}: Props & { interactive: boolean }) {
  const showPill = Boolean(delta) && deltaDirection !== "flat";

  return (
    <Card
      className={cn(
        "dashboard-card relative flex h-full min-h-[168px] flex-col border-l-[3px] border-l-[var(--color-accent-border)] transition-[transform,box-shadow,border-color] duration-150 ease-in-out",
        interactive &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_6px_24px_rgba(0,0,0,0.12)] focus-within:ring-2 focus-within:ring-primary/30"
      )}
    >
      <CardContent className="flex flex-1 flex-col px-5 pb-4 pt-5">
        <header className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug text-[#1a2332] dark:text-[hsl(0_0%_95%)]">{label}</span>
          <div className={cn("kpi-icon-badge shrink-0 rounded-xl p-2.5", iconToneClassMap[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </header>

        <div 
          className={cn(
            "mt-3 min-w-0 whitespace-nowrap tracking-tight text-[#1a2332] dark:text-[hsl(0_0%_95%)]",
            KPI_VALUE_CLASS
          )}
          data-testid={valueTestId}
        >
          {value}
        </div>

        <footer className="relative mt-auto flex flex-col items-start gap-2 pt-4 pr-6">
          {sub ? (
            <span className="w-full min-w-0 whitespace-normal break-words text-sm leading-relaxed text-[#334155] dark:text-[hsl(0_0%_95%)]">
              {sub}
            </span>
          ) : (
            <span className="w-full select-none text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]" aria-hidden>
              {"\u00a0"}
            </span>
          )}
          {showPill ? <DeltaPill delta={delta!} deltaDirection={deltaDirection} goodWhen={goodWhen} /> : null}
          {interactive ? (
            <ChevronRight
              className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 text-muted-foreground/80"
              aria-hidden
            />
          ) : null}
        </footer>
      </CardContent>
    </Card>
  );
}

export function KpiCard(props: Props) {
  const { href, label, ...rest } = props;
  if (!href) {
    return <KpiCardInner {...props} interactive={false} />;
  }

  return (
    <Link href={href} className="block h-full min-h-[168px] rounded-xl outline-none" aria-label={`View ${label}`}>
      <KpiCardInner label={label} {...rest} interactive />
    </Link>
  );
}
