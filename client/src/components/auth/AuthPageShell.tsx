import { cn } from "@/lib/utils";

/**
 * Centered Hero Auth Layout — cardless, structured column on the gradient.
 * Single pattern for landing, login, signup, magic-link verification.
 */
export function AuthHeroLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-blue-50 to-red-50 px-6 py-10">
      <div
        className={cn(
          "auth-container w-full max-w-[480px] px-6 py-8 text-center sm:px-8",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** @deprecated Use `AuthHeroLayout` — alias for migration clarity */
export const AuthCard = AuthHeroLayout;

/** Hero title — 34px, bold; `mt-2` (8px) after logo. */
export function AuthTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "mt-2 text-[34px] font-bold leading-tight tracking-tight text-neutral-900",
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

/** Logo — `public/nrcs-logo.png`; `mb-4` (16px) before title. */
export function AuthBrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("mb-4 flex shrink-0 justify-center", className)}>
      <img src="/nrcs-logo.png" alt="Nigerian Red Cross Society" className="mx-auto h-16 w-auto object-contain" />
    </div>
  );
}

/** Primary CTA — full width, red, elevated shadow (conversion anchor). */
export const authPrimaryButtonClass = cn(
  "mt-7 w-full min-h-[48px] rounded-[10px] px-7 py-3.5 text-[15px] font-semibold text-white",
  "bg-[#ef4444] shadow-[0_8px_20px_rgba(239,68,68,0.25)] transition-colors hover:bg-red-600"
);
