import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (theme === "system") setTheme("light");
  }, [theme, setTheme]);

  const baseClass =
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-black/10 dark:hover:bg-white/10";

  /** Reserve the 44px slot before mount so the top row does not shift once the theme is known. */
  if (!mounted) return <span aria-hidden className={cn(baseClass, "pointer-events-none", className)} />;

  const isDark = theme === "dark" || resolvedTheme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(baseClass, className)}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
    >
      {isDark ? <Moon className="w-5 h-5" aria-hidden /> : <Sun className="w-5 h-5" aria-hidden />}
    </button>
  );
}
