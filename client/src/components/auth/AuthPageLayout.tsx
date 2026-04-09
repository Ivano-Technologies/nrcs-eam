import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface AuthPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthPageLayout({ children, className }: AuthPageLayoutProps) {
  return (
    <div
      className={cn(
        "relative min-h-screen w-full flex flex-col items-center justify-center p-4",
        "bg-gradient-to-br from-red-50/40 via-white to-rose-50/30",
        "dark:bg-[#232323]",
        className
      )}
    >
      {/* Decorative blobs so glass blur has visible depth in light and dark */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-red-400/20 blur-3xl dark:bg-red-600/20" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-rose-300/20 blur-3xl dark:bg-red-800/20" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-200/15 blur-2xl dark:bg-red-700/15" />
      </div>

      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex w-full items-center justify-center">{children}</div>
    </div>
  );
}
