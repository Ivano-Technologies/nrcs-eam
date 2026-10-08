import { cn } from "@/lib/utils";

/**
 * The one page shell for every signed in page (rendered by DashboardLayout around the route).
 * Data pages are full width; pass `width="form"` (or wrap in `PageFormWidth`) for single form pages.
 */
export function PageShell({
  children,
  width = "full",
  className,
}: {
  children: React.ReactNode;
  width?: "full" | "form";
  className?: string;
}) {
  return (
    <div
      data-testid="page-shell"
      className={cn("w-full px-4 sm:px-6 py-6", width === "form" && "max-w-3xl", className)}
    >
      {children}
    </div>
  );
}

/** Single form pages (Settings sub forms): cap the width at `max-w-3xl` inside the shell. */
export function PageFormWidth({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full max-w-3xl", className)}>{children}</div>;
}
