import { getPasswordStrength, type PasswordStrengthLevel } from "@/lib/passwordStrength";
import { cn } from "@/lib/utils";

const WIDTH: Record<PasswordStrengthLevel, string> = {
  weak: "25%",
  fair: "50%",
  good: "75%",
  strong: "100%",
};

const BAR: Record<PasswordStrengthLevel, string> = {
  weak: "bg-red-500",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-green-600",
};

const LABEL: Record<PasswordStrengthLevel, string> = {
  weak: "text-red-600 dark:text-red-400",
  fair: "text-orange-600 dark:text-orange-400",
  good: "text-yellow-800 dark:text-yellow-500",
  strong: "text-green-700 dark:text-green-500",
};

export function PasswordStrengthBar({ password }: { password: string }) {
  if (!password.length) return null;
  const { level, label } = getPasswordStrength(password);
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-200", BAR[level])}
          style={{ width: WIDTH[level] }}
        />
      </div>
      <span className={cn("shrink-0 text-xs font-medium", LABEL[level])} aria-live="polite">
        {label}
      </span>
    </div>
  );
}
