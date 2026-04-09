import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

const liquidGlassStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(40px) saturate(180%)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  boxShadow:
    "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
};

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      style={liquidGlassStyle}
      className={cn("w-full max-w-md mx-auto rounded-3xl p-8 md:p-10", className)}
    >
      {children}
    </div>
  );
}
