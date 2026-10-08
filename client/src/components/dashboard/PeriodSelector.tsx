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
            "rounded-full border px-[14px] py-[5px] text-[13px] transition-[border-color,color] duration-150 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[#C8102E] dark:focus-visible:outline-white focus-visible:outline-offset-2",
            value === period
              ? "border-[#C8102E] bg-[#C8102E] font-medium text-white"
              : "border-[var(--color-border)] bg-transparent text-[var(--color-muted)] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[rgba(255,255,255,0.15)] dark:text-[hsl(0_0%_75%)] dark:hover:border-[#F87171] dark:hover:text-[#F87171]"
          )}
        >
          {period}
        </button>
      ))}
    </div>
  );
}
