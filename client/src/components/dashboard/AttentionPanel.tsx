import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  MapPin,
  Package,
  Shield,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useLocation } from "wouter";
import type { UserRole } from "./types";

const ICON_MAP: Record<string, LucideIcon> = {
  AlertTriangle,
  Users,
  Shield,
  CheckCircle2,
  ClipboardList,
  Package,
  Wrench,
  Truck,
  FileText,
  MapPin,
  Clock,
};

const TONE_MAP: Record<string, string> = {
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-[hsl(0_0%_95%)]",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-[hsl(0_0%_95%)]",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-[hsl(0_0%_95%)]",
  green: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-[hsl(0_0%_95%)]",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-[hsl(0_0%_95%)]",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-[hsl(0_0%_95%)]",
};

type Props = {
  role: UserRole;
};

export function AttentionPanel({ role }: Props) {
  const [, setLocation] = useLocation();
  const { data } = trpc.dashboard.attentionItems.useQuery({ role });

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="dashboard-section-title">Needs your attention</CardTitle>
        <CardDescription className="text-[#334155] dark:text-[hsl(0_0%_95%)]">Personalised for {role}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {(data ?? []).map((item, idx) => {
          const Icon = ICON_MAP[item.icon] ?? AlertTriangle;
          const clickable = Boolean(item.href);
          const RowTag = clickable ? ("button" as const) : ("div" as const);
          return (
            <RowTag
              key={`${item.label}-${idx}`}
              type={clickable ? "button" : undefined}
              className={cn(
                "w-full rounded-lg px-2 py-2 text-left transition-colors",
                clickable && "cursor-pointer hover:bg-gray-50 hover:ring-1 hover:ring-primary/20 dark:hover:bg-white/5",
                idx !== (data?.length ?? 0) - 1 ? "border-b border-border/60" : ""
              )}
              onClick={clickable ? () => setLocation(item.href!) : undefined}
              disabled={!clickable}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    TONE_MAP[item.tone] ?? TONE_MAP.blue
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1a2332] dark:text-[hsl(0_0%_95%)]">{item.label}</p>
                  <p className="text-xs text-[#334155] dark:text-[hsl(0_0%_95%)]">{item.meta}</p>
                </div>
                {clickable ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#334155] dark:text-[hsl(0_0%_95%)]" aria-hidden />
                ) : null}
              </div>
            </RowTag>
          );
        })}
      </CardContent>
    </Card>
  );
}
