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
        "relative min-h-screen w-full flex flex-col items-center",
        "bg-gradient-to-br from-red-50/40 via-white to-rose-50/30",
        "dark:from-[#232323] dark:via-[#2a2a2a] dark:to-[#232323]",
        className
      )}
    >
      {/* Top row (in flow, not absolute) so the toggle never overlaps the card at 390px. */}
      <div className="flex w-full justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full flex-1 items-center justify-center px-4">{children}</div>
      <IvanoCopyright className="px-4 pb-4 pt-6 text-center" />
    </div>
  );
}
