import { cn } from "@/lib/utils";
import { IvanoCopyright } from "@/components/brand/IvanoCopyright";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface AuthPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthPageLayout({ children, className }: AuthPageLayoutProps) {
  return (
    <div
      className={cn(
        "relative min-h-screen w-full flex flex-col items-center p-4",
        "bg-gradient-to-br from-red-50/40 via-white to-rose-50/30",
        "dark:from-[#232323] dark:via-[#2a2a2a] dark:to-[#232323]",
        className
      )}
    >
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="flex w-full flex-1 items-center justify-center">{children}</div>
      <IvanoCopyright className="pt-6 text-center" />
    </div>
  );
}
