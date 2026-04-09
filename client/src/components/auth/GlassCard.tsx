import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-md mx-auto",
        "bg-white/15 backdrop-blur-xl",
        "border border-white/30",
        "rounded-3xl shadow-2xl",
        "p-8 md:p-10",
        className
      )}
    >
      {children}
    </div>
  );
}
