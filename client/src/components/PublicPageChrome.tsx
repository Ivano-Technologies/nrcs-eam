import { IvanoCopyright } from "@/components/brand/IvanoCopyright";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

/**
 * Legal / standalone pages outside auth layout: theme toggle, page background, Ivano credit.
 * `className` overrides the page background so it runs under the credit too (no strip).
 */
export function PublicPageChrome({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col bg-background text-foreground dark:bg-[#232323]",
        className
      )}
    >
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="px-4 py-6">
        <IvanoCopyright className="text-center" />
      </footer>
    </div>
  );
}
