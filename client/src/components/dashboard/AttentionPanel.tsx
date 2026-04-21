import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
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
import { cn } from "@/lib/utils";
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
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-purple-100 text-purple-700",
};

type Props = {
  role: UserRole;
};

export function AttentionPanel({ role }: Props) {
  const { data } = trpc.dashboard.attentionItems.useQuery({ role });

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Needs your attention</CardTitle>
        <CardDescription>Personalised for {role}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {(data ?? []).map((item, idx) => {
          const Icon = ICON_MAP[item.icon] ?? AlertTriangle;
          return (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              className={cn(
                "w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50",
                idx !== (data?.length ?? 0) - 1 ? "border-b border-border/60" : ""
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE_MAP[item.tone] ?? TONE_MAP.blue)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
