import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type PageHeaderBack = {
  /** Text after the arrow, e.g. "Facilities". */
  label: string;
  href: string;
};

interface PageHeaderProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right aligned header actions (at most one primary red button per view). */
  actions?: React.ReactNode;
  /** Optional back link rendered above the title. */
  back?: PageHeaderBack;
  className?: string;
  /** Extra props for the h1 (e.g. data-testid). */
  titleTestId?: string;
}

/**
 * One page header for every signed in page: icon, h1, subtitle, actions and an optional back link.
 * Always ends with `mb-6` so the gap before tabs or content is the same everywhere.
 */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  back,
  className,
  titleTestId,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)} data-testid="page-header">
      {back ? (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E] dark:focus-visible:outline-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1
            className="flex items-center gap-2 text-3xl font-bold tracking-tight"
            data-testid={titleTestId}
          >
            {Icon ? <Icon className="h-8 w-8 shrink-0 text-primary dark:text-[#F87171]" aria-hidden /> : null}
            <span className="min-w-0 break-words">{title}</span>
          </h1>
          {subtitle ? (
            <p
              className="mt-1 max-w-2xl text-muted-foreground line-clamp-2 sm:line-clamp-none"
              title={typeof subtitle === "string" ? subtitle : undefined}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
