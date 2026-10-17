import { CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * IVA-168: a missing expiry date is its own grey "No date" status, never red and never counted as
 * compliant (Coco's fleet spec: status-chip fill, dashed status-none border, CircleHelp icon).
 */
export function NoDateBadge() {
  return (
    <Badge
      variant="outline"
      data-testid="status-no-date"
      className="gap-1 border-dashed border-status-none bg-status-chip text-muted-foreground"
    >
      <CircleHelp className="h-3 w-3" aria-hidden />
      No date
    </Badge>
  );
}
