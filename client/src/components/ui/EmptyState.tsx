import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  /** One sentence-case line, e.g. "No receipts yet". No second line of explanation. */
  title: string;
  /** The page's main action, only when the user is allowed to take it (a single Button). */
  action?: React.ReactNode;
  className?: string;
};

/** One empty state used everywhere: an icon, one line, and the main action when the user has permission. */
export function EmptyState({ icon: Icon = Inbox, title, action, className }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}
    >
      <Icon className="h-10 w-10 text-muted-foreground" aria-hidden />
      <p className="text-base font-medium text-foreground">{title}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** The empty state as a table row spanning every column (shadcn `Table`). */
export function TableEmptyState({ colSpan, ...props }: EmptyStateProps & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 whitespace-normal">
        <EmptyState {...props} />
      </TableCell>
    </TableRow>
  );
}

/** The empty state as a plain `<tr>` for hand written `<table>` markup. */
export function HtmlTableEmptyState({ colSpan, ...props }: EmptyStateProps & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <EmptyState {...props} />
      </td>
    </tr>
  );
}
