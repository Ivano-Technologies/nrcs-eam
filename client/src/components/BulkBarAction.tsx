import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Light buttons on the navy bar. Delete is the only red action. */
export const BULK_BAR_BUTTON_CLASS = "gap-2 border-0 bg-background text-foreground shadow-none hover:bg-muted";

const LONG_PRESS_MS = 450;
const TOOLTIP_HIDE_MS = 1500;

interface BulkBarActionProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  "data-testid"?: string;
  className?: string;
}

/**
 * Bulk bar action: icon only below md (label kept for screen readers via aria-label and sr-only text),
 * icon and label from md up. A touch long press shows the label as a tooltip without firing the action.
 */
export function BulkBarAction({ icon: Icon, label, onClick, disabled, className, ...rest }: BulkBarActionProps) {
  const [open, setOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clearPress = () => {
    if (pressTimer.current != null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  useEffect(
    () => () => {
      clearPress();
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    },
    []
  );

  return (
    <Tooltip open={open} onOpenChange={(next) => { if (!next || !longPressed.current) setOpen(next); }}>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(BULK_BAR_BUTTON_CLASS, "max-md:size-9 max-md:px-0", className)}
          disabled={disabled}
          aria-label={label}
          title={label}
          data-testid={rest["data-testid"]}
          onPointerDown={(e) => {
            if (e.pointerType !== "touch") return;
            longPressed.current = false;
            clearPress();
            pressTimer.current = window.setTimeout(() => {
              longPressed.current = true;
              setOpen(true);
              if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
              hideTimer.current = window.setTimeout(() => {
                setOpen(false);
                longPressed.current = false;
              }, TOOLTIP_HIDE_MS);
            }, LONG_PRESS_MS);
          }}
          onPointerUp={clearPress}
          onPointerLeave={clearPress}
          onPointerCancel={clearPress}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            if (longPressed.current) {
              e.preventDefault();
              return;
            }
            onClick();
          }}
        >
          <Icon className="h-4 w-4" aria-hidden />
          <span className="max-md:sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="z-[60]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
