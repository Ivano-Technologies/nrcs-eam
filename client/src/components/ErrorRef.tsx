import { cn } from "@/lib/utils";

/** IVA-189: the small grey support reference shown under every friendly error. */
export function ErrorRef({ code, className }: { code: string | null | undefined; className?: string }) {
  if (!code) return null;
  return (
    <span data-testid="error-ref" className={cn("mt-1 block text-xs text-muted-foreground", className)}>
      Ref: {code}
    </span>
  );
}
