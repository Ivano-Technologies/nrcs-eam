import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
}

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <Icon className="h-8 w-8 text-primary" />
        {title}
      </h1>
      {subtitle && (
        <p
          className="mt-1 text-muted-foreground max-w-2xl line-clamp-2 sm:line-clamp-none"
          title={subtitle}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
