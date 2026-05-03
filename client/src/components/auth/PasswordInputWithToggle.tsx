import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { authInputClass } from "./AuthPageShell";

type Props = Omit<React.ComponentProps<typeof Input>, "type">;

export function PasswordInputWithToggle({ className, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn(authInputClass, "pr-11", className)}
        {...rest}
      />
      <button
        type="button"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-600 hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-gray-300 dark:hover:bg-white/10"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4 shrink-0" aria-hidden /> : <Eye className="h-4 w-4 shrink-0" aria-hidden />}
      </button>
    </div>
  );
}
