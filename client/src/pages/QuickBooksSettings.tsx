import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";

export default function QuickBooksSettings() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [realmId, setRealmId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: config, refetch: refetchConfig } = trpc.quickbooks.getConfig.useQuery();
  const { data: connectionStatus, refetch: refetchConnection } = trpc.quickbooks.testConnection.useQuery();
  const saveConfigMutation = trpc.quickbooks.saveConfig.useMutation();
  const syncMutation = trpc.quickbooks.syncTransactions.useMutation();

  useEffect(() => {
    if (config) {
      setClientId(config.clientId || "");
      setClientSecret(config.clientSecret || "");
      setRealmId(config.realmId || "");
    }
  }, [config]);

  const handleSaveConfig = async () => {
    if (!clientId || !clientSecret || !realmId) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      await saveConfigMutation.mutateAsync({
        clientId,
        clientSecret,
        redirectUri: `${window.location.origin}/quickbooks/callback`,
        realmId,
      });
      toast.success("QuickBooks configuration saved");
      refetchConfig();
    } catch (error: any) {
      toast.error(error.message || "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = () => {
    if (!clientId) {
      toast.error("Please save configuration first");
      return;
    }

    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      `${window.location.origin}/quickbooks/callback`
    )}&response_type=code&scope=com.intuit.quickbooks.accounting&state=${Math.random().toString(36)}`;

    window.location.href = authUrl;
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(`Synced ${result.synced} transactions successfully`);
      if (result.failed > 0) {
        toast.warning(`${result.failed} transactions failed to sync`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to sync transactions");
    } finally {
      setIsSyncing(false);
    }
  };

  const isConnected = connectionStatus?.connected;
  const lastSync = config?.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : "Never";

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-navy-900">QuickBooks Integration</h1>
        <p className="text-gray-600 mt-2">
          Connect your NRCS EAM system to QuickBooks for automatic financial transaction sync
        </p>
      </div>

      {/* Connection Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connection Status
            {isConnected ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
          </CardTitle>
          <CardDescription>
            {isConnected
              ? "Your QuickBooks account is connected and ready to sync"
              : "Not connected to QuickBooks"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={isConnected ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Sync:</span>
              <span className="font-medium">{lastSync}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Auto Sync:</span>
              <span className="font-medium">{config?.autoSync ? "Enabled" : "Disabled"}</span>
            </div>
          </div>

          {isConnected && (
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSync} disabled={isSyncing} className="bg-navy-900 hover:bg-navy-800">
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => refetchConnection()}>
                Test Connection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>QuickBooks Configuration</CardTitle>
          <CardDescription>
            Enter your QuickBooks API credentials. You can obtain these from the{" "}
            <a
              href="https://developer.intuit.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:underline"
            >
              Intuit Developer Portal
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your QuickBooks Client ID"
              />
            </div>

            <div>
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter your QuickBooks Client Secret"
              />
            </div>

            <div>
              <Label htmlFor="realmId">Company ID (Realm ID)</Label>
              <Input
                id="realmId"
                value={realmId}
                onChange={(e) => setRealmId(e.target.value)}
                placeholder="Enter your QuickBooks Company ID"
              />
              <p className="text-sm text-gray-500 mt-1">
                This is your QuickBooks company identifier
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSaveConfig} disabled={isSaving} className="bg-navy-900 hover:bg-navy-800">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>

              {config && !isConnected && (
                <Button onClick={handleConnect} variant="outline" className="border-red-600 text-red-600 hover:bg-red-50">
                  Connect to QuickBooks
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Create a QuickBooks app at the Intuit Developer Portal</li>
            <li>Copy your Client ID and Client Secret from the app settings</li>
            <li>Add the redirect URI: <code className="bg-gray-100 px-2 py-1 rounded">{window.location.origin}/quickbooks/callback</code></li>
            <li>Enter your credentials above and save the configuration</li>
            <li>Click "Connect to QuickBooks" to authorize the integration</li>
            <li>Once connected, transactions will automatically sync to QuickBooks</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
