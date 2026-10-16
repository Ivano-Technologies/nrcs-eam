import { DashboardSectionError } from "@/components/dashboard/DashboardSectionError";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StockMovementPoint = {
  w: string;
  inbound: number;
  outbound: number;
};

type Props = {
  data: StockMovementPoint[];
  failed?: boolean;
  onRetry?: () => void;
};

export function StockMovementChart({ data, failed, onRetry }: Props) {
  const hasMovementData = data.some((point) => point.inbound > 0 || point.outbound > 0);
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="dashboard-section-title">Stock movement</CardTitle>
            <CardDescription className="text-contrast dark:text-[hsl(0_0%_95%)]">Last 12 weeks · units × 100</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs text-contrast dark:text-[hsl(0_0%_95%)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-chart-inbound" />
              Inbound
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-chart-outbound" />
              Outbound
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-[280px] min-h-[200px] overflow-x-auto">
        {failed ? (
          <DashboardSectionError onRetry={onRetry} />
        ) : !hasMovementData ? (
          <EmptyState icon={BarChart3} title="No stock movements yet" className="h-full py-0" />
        ) : (
          <ResponsiveContainer width="100%" minHeight={200} height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="inboundFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-inbound)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--chart-inbound)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="outboundFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-outbound)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--chart-outbound)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="w" tick={{ fill: "var(--dashboard-contrast-text)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--dashboard-contrast-text)", fontSize: 12 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--chart-tooltip)",
                  borderRadius: "0.75rem",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  color: isDark ? "hsl(0 0% 95%)" : "var(--navy)",
                }}
              />
              <Area type="monotone" dataKey="inbound" stroke="var(--chart-inbound)" fillOpacity={1} fill="url(#inboundFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="outbound" stroke="var(--chart-outbound)" fillOpacity={1} fill="url(#outboundFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
