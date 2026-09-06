import { Button } from "@/components/ui/button";

type Props = {
  onRetry?: () => void;
  compact?: boolean;
};

export function DashboardSectionError({ onRetry, compact = false }: Props) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-start gap-2"
          : "flex min-h-[88px] flex-col items-start justify-center gap-2"
      }
      role="status"
    >
      <p className="text-sm text-[#334155] dark:text-[hsl(0_0%_95%)]">Couldn't load</p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
