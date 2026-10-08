import { cn } from "@/lib/utils";
import { AuthPageLayout } from "./AuthPageLayout";
import { GlassCard } from "./GlassCard";

/**
 * Full-page gradient + iOS-style glass card. Prefer importing `AuthPageLayout` + `GlassCard` directly in new code.
 */
export function AuthHeroLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AuthPageLayout>
      <GlassCard className={className}>{children}</GlassCard>
    </AuthPageLayout>
  );
}

/** @deprecated Use `AuthHeroLayout` — alias for migration clarity */
export const AuthCard = AuthHeroLayout;

/** Hero title — 34px, bold; `mt-2` (8px) after logo. */
export function AuthTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "mt-2 text-[34px] font-bold leading-tight tracking-tight text-gray-900 dark:text-gray-100",
        className
      )}
    >
      {children}
    </h1>
  );
}

/** Hero subtitle — 16px, muted. */
export function AuthSubtitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mt-2.5 text-base leading-relaxed text-[#6b7280] dark:text-gray-400",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Footer line — 13px, light gray. */
export function AuthFooterNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 text-[13px] leading-relaxed text-[#6B7280] dark:text-gray-400">{children}</p>
  );
}

/** Logo — `public/nrcs-logo.png`; spacing before title. */
export function AuthBrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("mb-6 flex shrink-0 justify-center", className)}>
      <img src="/nrcs-logo.png" alt="Nigerian Red Cross Society" className="mx-auto h-16 w-auto object-contain" />
    </div>
  );
}

/** Auth inputs: solid fill and a 3:1 border so fields read as fields on the glass card. */
export const authInputClass = cn(
  "h-12 rounded-[10px] bg-white border border-[#8A8F98] text-[15px] placeholder:text-gray-500",
  "focus-visible:border-[#C8102E] focus-visible:ring-2 focus-visible:ring-[#C8102E]/30",
  "dark:bg-white/10 dark:border-white/40 dark:text-white dark:placeholder:text-white/60"
);

/** Primary CTA — full width, red, elevated shadow (conversion anchor). */
export const authPrimaryButtonClass = cn(
  "mt-7 w-full min-h-[48px] rounded-[10px] px-7 py-3.5 text-[15px] font-semibold text-white",
  "bg-[#C8102E] shadow-[0_8px_20px_rgba(200,16,46,0.25)] transition-colors hover:bg-[#A50D26]"
);
