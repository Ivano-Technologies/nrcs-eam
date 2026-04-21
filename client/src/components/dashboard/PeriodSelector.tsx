import { cn } from "@/lib/utils";
import type { DashboardPeriod } from "./types";

const PERIODS: DashboardPeriod[] = ["Today", "Week", "Month", "Quarter", "Year"];

type Props = {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
};

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="rounded-xl border bg-card p-1 inline-flex items-center gap-1">
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          onClick={() => onChange(period)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            value === period ? "bg-foreground text-background" : "bg-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {period}
        </button>
      ))}
    </div>
  );
}
