import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AttentionPanel } from "@/components/dashboard/AttentionPanel";
import { FacilityStatusList } from "@/components/dashboard/FacilityStatusList";
import { FieldDashboard } from "@/components/dashboard/FieldDashboard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { RequisitionsTable } from "@/components/dashboard/RequisitionsTable";
import { StockMovementChart } from "@/components/dashboard/StockMovementChart";
import { useDashboardRolePreview } from "@/components/dashboard/rolePreviewContext";
import type { DashboardPeriod, UserRole } from "@/components/dashboard/types";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const rawRole = user?.role ?? "";
  const fixedLayout = rawRole === "staff" || rawRole === "field";

  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery({ period });
  const { data: pendingReqs } = trpc.dashboard.pendingRequisitions.useQuery();
  const { data: movement } = trpc.dashboard.stockMovement.useQuery({ weeks: period === "Today" ? 4 : 12 });
  const { data: userPreferences } = trpc.userPreferences.get.useQuery();
  const { data: branchPerf } = trpc.dashboard.branchPerformance.useQuery(undefined, {
    enabled: effectiveRole === "Manager" || effectiveRole === "Admin",
  });

  const widgetVisibility = useMemo(() => {
    if (fixedLayout) return DEFAULT_WIDGETS;
    if (!userPreferences?.dashboardWidgets) return DEFAULT_WIDGETS;
    try {
      const parsed = JSON.parse(userPreferences.dashboardWidgets) as Partial<typeof DEFAULT_WIDGETS>;
      return { ...DEFAULT_WIDGETS, ...parsed };
    } catch {
      return DEFAULT_WIDGETS;
    }
  }, [userPreferences?.dashboardWidgets, fixedLayout]);

  const normalizeDirection = (direction?: string): "up" | "down" | "flat" =>
    direction === "up" || direction === "down" ? direction : "flat";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (effectiveRole === "Field") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-[#334155] dark:text-[hsl(0_0%_95%)]">Field view — your branch only</p>
          </div>
        </div>
        <FieldDashboard />
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

  const staffKpis = allKpis.filter((k) => ["lowStock", "requisitions", "approvals"].includes(k.key));
  const kpis = effectiveRole === "Staff" ? staffKpis : allKpis;

  const showWidgets = (key: keyof typeof DEFAULT_WIDGETS) => fixedLayout || widgetVisibility[key];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-[#334155] dark:text-[hsl(0_0%_95%)]">Overview of your asset management system</p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {(effectiveRole === "Manager" || effectiveRole === "Admin") && branchPerf?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Branch Performance</CardTitle>
            <CardDescription>Stock readiness by branch (warehouse stock cards)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {branchPerf.slice(0, 12).map((b) => (
                <div key={b.id} className="rounded-lg border px-3 py-2 text-sm">
                  <p className="font-medium">{b.name}</p>
                  <p className="text-muted-foreground">
                    {b.stockScorePercent != null ? `${b.stockScorePercent}% ready` : "No stock data"}
                    {b.totalCards ? ` · ${b.adequateCards}/${b.totalCards} cards` : ""}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {effectiveRole === "Manager" && showWidgets("facilityStatus") ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Facility status</h2>
          <FacilityStatusList />
        </div>
      ) : null}

      {showWidgets("kpiCards") ? (
        <div className="grid max-[359px]:grid-cols-1 grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-5">
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

      {effectiveRole === "Staff" ? (
        showWidgets("stockMovement") ? (
          <div className="grid gap-6">
            <StockMovementChart data={movement ?? []} />
          </div>
        ) : null
      ) : (
        <>
          {showWidgets("stockMovement") || showWidgets("attentionPanel") ? (
            <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-[1.55fr_1fr]">
              {showWidgets("stockMovement") ? <StockMovementChart data={movement ?? []} /> : null}
              {showWidgets("attentionPanel") ? <AttentionPanel role={effectiveRole} /> : null}
            </div>
          ) : null}
          {showWidgets("activityFeed") || showWidgets("facilityStatus") ? (
            <div className="grid gap-6 md:grid-cols-2">
              {showWidgets("activityFeed") ? <ActivityFeed /> : null}
              {effectiveRole !== "Manager" && showWidgets("facilityStatus") ? <FacilityStatusList /> : null}
            </div>
          ) : null}
          {showWidgets("requisitionsTable") ? <RequisitionsTable /> : null}
        </>
      )}
    </div>
  );
}
