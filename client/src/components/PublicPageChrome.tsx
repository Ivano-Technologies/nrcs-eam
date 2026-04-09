import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** Legal / standalone pages outside auth layout — theme toggle + page background. */
export function PublicPageChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground dark:bg-[#232323]">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
