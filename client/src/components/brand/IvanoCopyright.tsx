import { cn } from "@/lib/utils";

/** Single credit line, same copy as the Ivano PMS app. */
export const IVANO_COPYRIGHT = "© 2026 Ivano Technologies";

/**
 * Subtle grey credit (© year + company), matching Ivano PMS `IvanoCopyright`
 * (`text-[13px] leading-[18px] font-medium text-muted-foreground`). No logo.
 */
export function IvanoCopyright({ className }: { className?: string }) {
  return (
    <p
      data-testid="ivano-copyright"
      className={cn("text-[13px] leading-[18px] font-medium text-muted-foreground", className)}
    >
      {IVANO_COPYRIGHT}
    </p>
  );
}
