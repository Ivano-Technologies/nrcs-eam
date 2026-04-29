import { cn } from "@/lib/utils";
import type { DashboardPeriod } from "./types";

const PERIODS: DashboardPeriod[] = ["Today", "Week", "Month", "Quarter", "Year"];

type Props = {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
};

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto whitespace-nowrap rounded-full bg-[#f1f3f5] p-1">
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          onClick={() => onChange(period)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EE1C25] focus-visible:outline-offset-2",
            value === period
              ? "bg-white font-semibold text-[#EE1C25] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              : "bg-transparent text-[#6b7280] hover:text-[#1a2332]"
          )}
        >
          {period}
        </button>
      ))}
    </div>
  );
}
