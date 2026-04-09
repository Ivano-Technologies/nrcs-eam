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
        "relative min-h-screen w-full flex items-center justify-center p-4",
        "bg-gradient-to-br from-red-50/40 via-white to-rose-50/30",
        "dark:from-[#232323] dark:via-[#2a2a2a] dark:to-[#232323]",
        className
      )}
    >
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
