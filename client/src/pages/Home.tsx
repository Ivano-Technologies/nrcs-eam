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
import { formatNaira } from "@/lib/format";
import { Clock, FileText, MapPin, Package, Users } from "lucide-react";
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
  const stockDeltaNaira = metrics?.stockValue.deltaNaira;
  const stockDeltaFormatted =
    stockDeltaNaira != null && stockDeltaNaira !== 0
      ? `${stockDeltaNaira > 0 ? "+" : "−"}${formatNaira(Math.abs(stockDeltaNaira), { compact: true })}`
      : undefined;

  const allKpis = [
    {
      key: "beneficiaries" as const,
      label: "Beneficiaries Reached (YTD)",
      value: new Intl.NumberFormat().format(metrics?.beneficiariesReached.value ?? 0),
      sub: undefined,
      icon: Users,
      tone: "red" as const,
      delta: metrics?.beneficiariesReached.delta,
      deltaDirection: normalizeDirection(metrics?.beneficiariesReached.direction),
      goodWhen: (metrics?.beneficiariesReached.goodWhen ?? "up") as "up" | "down",
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
      label: "Stock Value",
      value: formatNaira(metrics?.stockValue.value ?? 0, { compact: true }),
      sub: undefined,
      icon: Package,
      tone: "purple" as const,
      delta: stockDeltaFormatted,
      deltaDirection: normalizeDirection(metrics?.stockValue.direction),
      goodWhen: (metrics?.stockValue.goodWhen ?? "up") as "up" | "down",
    },
    {
      key: "approvals" as const,
      label: "Pending Approvals",
      value: metrics?.pendingApprovals.value ?? 0,
      sub: `${metrics?.pendingApprovals.urgent ?? 0} urgent · oldest ${metrics?.pendingApprovals.oldestDays ?? 0}d`,
      icon: FileText,
      tone: "orange" as const,
      delta: metrics?.pendingApprovals.delta,
      deltaDirection: normalizeDirection(metrics?.pendingApprovals.direction),
      goodWhen: (metrics?.pendingApprovals.goodWhen ?? "down") as "up" | "down",
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
  const kpis = effectiveRole === "Field" ? allKpis.filter((k) => ["beneficiaries", "facilities", "response"].includes(k.key)) : allKpis;

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
