import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, Mail } from "lucide-react";
import { toast } from "sonner";

export default function WarrantyAlerts() {
  const { data: expiringWarranties, isLoading } = trpc.assets.getExpiringWarranties.useQuery();
  
  const sendAlertMutation = trpc.assets.sendWarrantyAlert.useMutation({
    onSuccess: () => {
      toast.success("Warranty alert sent successfully");
    },
    onError: (error) => {
      toast.error(`Failed to send alert: ${error.message}`);
    },
  });

  const getDaysUntilExpiry = (expiryDate: Date | string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgencyColor = (days: number) => {
    if (days < 0) return "destructive";
    if (days <= 30) return "destructive";
    if (days <= 60) return "warning";
    return "secondary";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Warranty Alerts</h1>
          <p className="text-muted-foreground mt-2">
            Monitor asset warranties and receive expiration alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-sm text-muted-foreground">
            {expiringWarranties?.filter(a => getDaysUntilExpiry(a.warrantyExpiry!) <= 90).length || 0} expiring soon
          </span>
        </div>
      </div>

      <div className="grid gap-4">
        {expiringWarranties?.map((asset) => {
          const daysUntil = getDaysUntilExpiry(asset.warrantyExpiry!);
          const urgency = getUrgencyColor(daysUntil);

          return (
            <Card key={asset.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{asset.name}</CardTitle>
                  <Badge variant={urgency as any}>
                    {daysUntil < 0 ? "Expired" : `${daysUntil} days left`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Asset Tag</p>
                    <p className="font-medium">{asset.assetTag}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Manufacturer</p>
                    <p className="font-medium">{asset.manufacturer || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="font-medium">{asset.model || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Warranty Expiry</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(asset.warrantyExpiry!).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendAlertMutation.mutate({ assetId: asset.id })}
                  disabled={sendAlertMutation.isPending}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send Alert Email
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {(!expiringWarranties || expiringWarranties.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No warranties expiring in the next 90 days</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
