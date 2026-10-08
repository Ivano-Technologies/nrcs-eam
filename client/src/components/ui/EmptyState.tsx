import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  /** "No {things} yet" */
  title: string;
  /** "{Things} appear here once {trigger}." */
  body?: string;
  /** Optional primary action (a single Button). */
  action?: React.ReactNode;
  className?: string;
};

/** One empty state used everywhere: icon, title, body and an optional primary action. */
export function EmptyState({ icon: Icon = Inbox, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}
    >
      <Icon className="h-10 w-10 text-muted-foreground" aria-hidden />
      <p className="text-base font-medium text-foreground">{title}</p>
      {body ? <p className="max-w-md text-sm text-muted-foreground">{body}</p> : null}
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
