import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AttentionPanel } from "@/components/dashboard/AttentionPanel";
import { FacilityStatusList } from "@/components/dashboard/FacilityStatusList";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { RequisitionsTable } from "@/components/dashboard/RequisitionsTable";
import { StockMovementChart } from "@/components/dashboard/StockMovementChart";
import { useDashboardRolePreview } from "@/components/dashboard/rolePreviewContext";
import type { DashboardPeriod, UserRole } from "@/components/dashboard/types";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ClipboardList, MapPin, ShieldCheck, Truck } from "lucide-react";
import { useMemo, useState } from "react";

const DEFAULT_WIDGETS = {
  kpiCards: true,
  stockMovement: true,
  attentionPanel: true,
  activityFeed: true,
  facilityStatus: true,
  requisitionsTable: true,
} as const;

export default function Home() {
  const { user } = useAuth();
  const rolePreview = useDashboardRolePreview();
  const [period, setPeriod] = useState<DashboardPeriod>("Month");

  const actualRole = useMemo<UserRole>(() => {
    const role = user?.role ?? "staff";
    if (role === "admin") return "Admin";
    if (role === "manager") return "Manager";
    if (role === "staff") return "Staff";
    if (role === "field") return "Field";
    return "Field";
  }, [user?.role]);

  const effectiveRole = rolePreview?.effectiveRole ?? actualRole;

  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery({ period });
  const { data: pendingReqs } = trpc.dashboard.pendingRequisitions.useQuery();
  const { data: movement } = trpc.dashboard.stockMovement.useQuery({ weeks: period === "Today" ? 4 : 12 });
  const { data: userPreferences } = trpc.userPreferences.get.useQuery();
  const widgetVisibility = useMemo(() => {
    if (!userPreferences?.dashboardWidgets) return DEFAULT_WIDGETS;
    try {
      const parsed = JSON.parse(userPreferences.dashboardWidgets) as Partial<typeof DEFAULT_WIDGETS>;
      return { ...DEFAULT_WIDGETS, ...parsed };
    } catch {
      return DEFAULT_WIDGETS;
    }
  }, [userPreferences?.dashboardWidgets]);
  const normalizeDirection = (direction?: string): "up" | "down" | "flat" =>
    direction === "up" || direction === "down" ? direction : "flat";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  const periodLabel = period.toLowerCase();
  const readinessDelta = Number(metrics?.stockReadiness?.delta ?? 0);
  const readinessDeltaFormatted =
    readinessDelta === 0 ? "0 this period" : `${readinessDelta > 0 ? "+" : ""}${readinessDelta} this ${periodLabel}`;
  const distributionDelta =
    metrics?.distributionVelocity?.hasData
      ? `${Number(metrics?.distributionVelocity?.deltaPercent ?? 0) > 0 ? "+" : ""}${Number(metrics?.distributionVelocity?.deltaPercent ?? 0)}%`
      : undefined;
  const readinessTone: "green" | "orange" | "red" =
    (metrics?.stockReadiness?.tone ?? "red") === "amber"
      ? "orange"
      : (metrics?.stockReadiness?.tone as "green" | "red" | undefined) ?? "red";

  const allKpis = [
    {
      key: "lowStock" as const,
      label: "Low Stock Items",
      value: metrics?.lowStockItems.value ?? 0,
      sub: "Below reorder point",
      icon: AlertTriangle,
      tone: "red" as const,
      delta: metrics?.lowStockItems.delta,
      deltaDirection: normalizeDirection(metrics?.lowStockItems.direction),
      goodWhen: (metrics?.lowStockItems.goodWhen ?? "down") as "up" | "down",
    },
    {
      key: "facilities" as const,
      label: "Active Facilities",
      value: metrics?.activeFacilities.value ?? 0,
      sub: `of ${metrics?.activeFacilities.total ?? 0} · ${metrics?.activeFacilities.offline ?? 0} offline`,
      icon: MapPin,
      tone: "blue" as const,
      delta: undefined,
      deltaDirection: "flat" as const,
      goodWhen: (metrics?.activeFacilities.goodWhen ?? "up") as "up" | "down",
    },
    {
      key: "stock" as const,
      label: "Stock Readiness",
      value: `${metrics?.stockReadiness?.adequate ?? 0} of ${metrics?.stockReadiness?.total ?? 0}`,
      sub: `${metrics?.stockReadiness?.adequate ?? 0} facilities adequately stocked`,
      icon: ShieldCheck,
      tone: readinessTone,
      delta: readinessDeltaFormatted,
      deltaDirection: normalizeDirection(metrics?.stockReadiness?.direction),
      goodWhen: (metrics?.stockReadiness?.goodWhen ?? "up") as "up" | "down",
    },
    {
      key: "approvals" as const,
      label: "Units Distributed",
      value: Number(metrics?.distributionVelocity?.value ?? 0).toLocaleString(),
      sub:
        metrics?.distributionVelocity?.hasData
          ? `units distributed this ${periodLabel}`
          : "No distributions recorded yet",
      icon: Truck,
      tone: "blue" as const,
      delta: distributionDelta,
      deltaDirection: normalizeDirection(metrics?.distributionVelocity?.direction),
      goodWhen: (metrics?.distributionVelocity?.goodWhen ?? "up") as "up" | "down",
    },
    {
      key: "requisitions" as const,
      label: "Pending Requisitions",
      value: pendingReqs?.total ?? 0,
      sub: (() => {
        const u = pendingReqs?.urgent ?? 0;
        const d = pendingReqs?.oldestDaysAgo;
        if ((pendingReqs?.total ?? 0) === 0) return "No pending requisitions";
        const parts: string[] = [];
        if (u > 0) parts.push(`${u} urgent`);
        if (d !== null && d !== undefined) parts.push(`oldest ${d}d`);
        return parts.join(" · ") || "Pending review";
      })(),
      icon: ClipboardList,
      tone: (pendingReqs?.urgent ?? 0) > 0 ? ("red" as const) : ("blue" as const),
      delta: undefined,
      deltaDirection: "flat" as const,
      goodWhen: "down" as const,
    },
  ];
  const kpis =
    effectiveRole === "Field" ? allKpis.filter((k) => ["lowStock", "facilities", "stock"].includes(k.key)) : allKpis;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Overview of your asset management system</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {effectiveRole === "Field" && widgetVisibility.attentionPanel ? (
        <AttentionPanel role={effectiveRole} />
      ) : null}

      {widgetVisibility.kpiCards ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.key}
              label={kpi.label}
              value={kpi.value}
              sub={kpi.sub}
              icon={kpi.icon}
              tone={kpi.tone}
              delta={kpi.delta}
              deltaDirection={kpi.deltaDirection}
              goodWhen={kpi.goodWhen}
              valueTestId={`dashboard-kpi-value-${kpi.key}`}
            />
          ))}
        </div>
      ) : null}

      {effectiveRole === "Field" ? (
        widgetVisibility.activityFeed ? <ActivityFeed /> : null
      ) : (
        <>
          {widgetVisibility.stockMovement || widgetVisibility.attentionPanel ? (
            <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
              {widgetVisibility.stockMovement ? <StockMovementChart data={movement ?? []} /> : null}
              {widgetVisibility.attentionPanel ? <AttentionPanel role={effectiveRole} /> : null}
            </div>
          ) : null}
          {widgetVisibility.activityFeed || widgetVisibility.facilityStatus ? (
            <div className="grid gap-6 md:grid-cols-2">
              {widgetVisibility.activityFeed ? <ActivityFeed /> : null}
              {widgetVisibility.facilityStatus ? <FacilityStatusList /> : null}
            </div>
          ) : null}
          {widgetVisibility.requisitionsTable ? <RequisitionsTable /> : null}
        </>
      )}
    </div>
  );
}
