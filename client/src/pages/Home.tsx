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
import { AlertTriangle, Clock, MapPin, ShieldCheck, Truck } from "lucide-react";
import { useMemo, useState } from "react";

export default function Home() {
  const { user } = useAuth();
  const rolePreview = useDashboardRolePreview();
  const [period, setPeriod] = useState<DashboardPeriod>("Month");

  const actualRole = useMemo<UserRole>(() => {
    const role = user?.role ?? "staff";
    if (role === "admin") return "Admin";
    if (role === "manager") return "Manager";
    if (role === "staff") return "Staff";
    return "Field";
  }, [user?.role]);

  const effectiveRole = rolePreview?.effectiveRole ?? actualRole;

  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery({ period });
  const { data: movement } = trpc.dashboard.stockMovement.useQuery({ weeks: period === "Today" ? 4 : 12 });
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
      key: "response" as const,
      label: "Avg Response Time",
      value: `${metrics?.avgResponseHours.value ?? 0} hrs`,
      sub: undefined,
      icon: Clock,
      tone: "green" as const,
      delta: metrics?.avgResponseHours.delta,
      deltaDirection: normalizeDirection(metrics?.avgResponseHours.direction),
      goodWhen: (metrics?.avgResponseHours.goodWhen ?? "down") as "up" | "down",
    },
  ];
  const kpis = effectiveRole === "Field" ? allKpis.filter((k) => ["lowStock", "facilities", "response"].includes(k.key)) : allKpis;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Overview of your asset management system</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {effectiveRole === "Field" ? (
        <AttentionPanel role={effectiveRole} />
      ) : null}

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

      {effectiveRole === "Field" ? (
        <ActivityFeed />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
            <StockMovementChart data={movement ?? []} />
            <AttentionPanel role={effectiveRole} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <ActivityFeed />
            <FacilityStatusList />
          </div>
          <RequisitionsTable />
        </>
      )}
    </div>
  );
}
