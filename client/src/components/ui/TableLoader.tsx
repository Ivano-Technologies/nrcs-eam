import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROW_COUNT = 5;

type TableLoaderProps = {
  className?: string;
};

export default function TableLoader({ className }: TableLoaderProps) {
  return (
    <div className={cn("w-full", className)}>
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center gap-4 py-3",
            index < ROW_COUNT - 1 && "border-b border-border"
          )}
        >
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="ml-auto h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
}
