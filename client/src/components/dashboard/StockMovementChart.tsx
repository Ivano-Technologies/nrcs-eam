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
};

export function StockMovementChart({ data }: Props) {
  const hasMovementData = data.some((point) => point.inbound > 0 || point.outbound > 0);

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="dashboard-section-title">Stock movement</CardTitle>
            <CardDescription>Last 12 weeks · units × 100</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              Inbound
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
              Outbound
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-[280px] min-h-[200px] overflow-x-auto">
        {!hasMovementData ? (
          <div className="dashboard-empty-state flex h-full flex-col items-center justify-center gap-2">
            <BarChart3 className="dashboard-empty-state-icon" />
            <p className="text-sm font-medium">No stock movements recorded yet</p>
            <p className="dashboard-empty-state-subtitle text-xs">GRN and Waybill activity will appear here</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" minHeight={200} height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="inboundFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="outboundFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="w" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  borderRadius: "0.75rem",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                }}
              />
              <Area type="monotone" dataKey="inbound" stroke="#DC2626" fillOpacity={1} fill="url(#inboundFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="outbound" stroke="#2563EB" fillOpacity={1} fill="url(#outboundFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
