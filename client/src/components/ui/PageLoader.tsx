import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageLoaderProps = {
  className?: string;
};

export default function PageLoader({ className }: PageLoaderProps) {
  return (
    <div className={cn("w-full", className)}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-1 h-4 w-32" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="mt-6 h-64 w-full rounded-xl" />
    </div>
  );
}
