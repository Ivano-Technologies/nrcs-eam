import { IvanoCopyright } from "@/components/brand/IvanoCopyright";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** Legal / standalone pages outside auth layout: theme toggle, page background, Ivano credit. */
export function PublicPageChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground dark:bg-[#232323]">
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
