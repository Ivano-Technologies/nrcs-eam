import { cn } from "@/lib/utils";
import type { DashboardPeriod } from "./types";

const PERIODS: DashboardPeriod[] = ["Today", "Week", "Month", "Quarter", "Year"];

type Props = {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
};

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="inline-flex max-w-full flex-nowrap items-center gap-[6px] overflow-x-auto whitespace-nowrap">
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          onClick={() => onChange(period)}
          className={cn(
            "rounded-full border px-[14px] py-[5px] text-[13px] transition-[border-color,color] duration-150 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-primary dark:focus-visible:outline-white focus-visible:outline-offset-2",
            value === period
              ? "border-primary bg-primary font-medium text-white"
              : "border-[var(--color-border)] bg-transparent text-[var(--color-muted)] hover:border-primary hover:text-primary dark:border-[rgba(255,255,255,0.15)] dark:text-[hsl(0_0%_75%)] dark:hover:border-primary-on-dark dark:hover:text-primary-on-dark"
          )}
        >
          {period}
        </button>
      ))}
    </div>
  );
}
