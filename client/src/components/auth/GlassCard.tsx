import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const glassStyle: CSSProperties = {
    background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.08)",
    backdropFilter: "blur(40px) saturate(180%)",
    WebkitBackdropFilter: "blur(40px) saturate(180%)",
    border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: isDark
      ? "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
      : "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
  };

  return (
    <div
      style={glassStyle}
      className={cn("w-full max-w-md mx-auto rounded-3xl p-8 md:p-10", className)}
    >
      {children}
    </div>
  );
}
