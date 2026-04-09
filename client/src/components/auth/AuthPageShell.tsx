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
        "mt-2 text-[34px] font-bold leading-tight tracking-tight text-gray-900",
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
    <p className={cn("mt-2.5 text-base leading-relaxed text-[#6b7280]", className)}>{children}</p>
  );
}

/** Footer line — 13px, light gray. */
export function AuthFooterNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 text-[13px] leading-relaxed text-[#9ca3af]">{children}</p>;
}

/** Logo — `public/nrcs-logo.png`; spacing before title. */
export function AuthBrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("mb-6 flex shrink-0 justify-center", className)}>
      <img src="/nrcs-logo.png" alt="Nigerian Red Cross Society" className="mx-auto h-16 w-auto object-contain" />
    </div>
  );
}

/** Inputs on glass surfaces — light frosted fill for contrast. */
export const authInputClass = cn(
  "h-12 rounded-[10px] text-[15px] bg-white/50 border-white/40 placeholder:text-gray-500"
);

/** Primary CTA — full width, red, elevated shadow (conversion anchor). */
export const authPrimaryButtonClass = cn(
  "mt-7 w-full min-h-[48px] rounded-[10px] px-7 py-3.5 text-[15px] font-semibold text-white",
  "bg-[#ef4444] shadow-[0_8px_20px_rgba(239,68,68,0.25)] transition-colors hover:bg-red-600"
);
