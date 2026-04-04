import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Html5Qrcode } from "html5-qrcode";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, Search, Package, MapPin, CheckCircle, XCircle } from "lucide-react";

export default function AssetScanner() {
  const [, setLocation] = useLocation();
  const [scanMode, setScanMode] = useState<"manual" | "camera">("manual");
  const [assetTag, setAssetTag] = useState("");
  const [scannedAsset, setScannedAsset] = useState<any>(null);
  const [updateForm, setUpdateForm] = useState({
    status: "",
    location: "",
    notes: "",
  });
  const [isScanning, setIsScanning] = useState(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  const { data: asset, refetch: searchAsset } = trpc.assets.getByTag.useQuery(
    { assetTag },
    { enabled: false }
  );

  const updateAssetMutation = trpc.assets.update.useMutation({
    onSuccess: () => {
      toast.success("Asset updated successfully");
      setScannedAsset(null);
      setAssetTag("");
      setUpdateForm({ status: "", location: "", notes: "" });
    },
    onError: (error) => {
      toast.error(`Failed to update asset: ${error.message}`);
    },
  });

  const handleScan = async () => {
    if (!assetTag.trim()) {
      toast.error("Please enter an asset tag");
      return;
    }

    try {
      const result = await searchAsset();
      if (result.data) {
        setScannedAsset(result.data);
        setUpdateForm({
          status: result.data.status || "",
          location: result.data.location || "",
          notes: "",
        });
        toast.success("Asset found!");
      } else {
        toast.error("Asset not found");
        setScannedAsset(null);
      }
    } catch (error) {
      toast.error("Failed to find asset");
      setScannedAsset(null);
    }
  };

    const handleQuickUpdate = () => {
    if (!scannedAsset) return;

    updateAssetMutation.mutate({
      id: scannedAsset.id,
      status: updateForm.status || scannedAsset.status,
      location: updateForm.location || scannedAsset.location,
      notes: updateForm.notes 
        ? `${scannedAsset.notes || ""}

[Scanner Update ${new Date().toLocaleString()}]
${updateForm.notes}`
        : scannedAsset.notes,
    });
  };

  const startCameraScanning = async () => {
    try {
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode("qr-reader");
      }

      setIsScanning(true);
      await html5QrcodeRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setAssetTag(decodedText);
          toast.success(`Scanned: ${decodedText}`);
          stopCameraScanning();
          // Auto-search after scan
          setTimeout(() => {
            handleScan();
          }, 500);
        },
        (error) => {
          // Ignore scanning errors (happens continuously while scanning)
        }
      );
    } catch (error) {
      toast.error("Failed to start camera. Please check permissions.");
      setIsScanning(false);
      setScanMode("manual");
    }
  };

  const stopCameraScanning = async () => {
    try {
      if (html5QrcodeRef.current && isScanning) {
        await html5QrcodeRef.current.stop();
        setIsScanning(false);
      }
    } catch (error) {
      console.error("Error stopping camera:", error);
    }
  };

  useEffect(() => {
    if (scanMode === "camera" && !isScanning) {
      startCameraScanning();
    } else if (scanMode === "manual" && isScanning) {
      stopCameraScanning();
    }

    return () => {
      if (isScanning) {
        stopCameraScanning();
      }
    };
  }, [scanMode]);;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Asset Scanner</h1>
          <p className="text-muted-foreground mt-1">
            Quick scan and update assets in the field
          </p>
        </div>

        {/* Scanner Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Scan Asset
            </CardTitle>
            <CardDescription>
              Enter asset tag or barcode to find asset
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scan Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={scanMode === "manual" ? "default" : "outline"}
                onClick={() => setScanMode("manual")}
                className="flex-1"
              >
                <Search className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
              <Button
                variant={scanMode === "camera" ? "default" : "outline"}
                onClick={() => setScanMode("camera")}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Camera Scan
              </Button>
            </div>

            {/* Camera Scan */}
            {scanMode === "camera" && (
              <div className="space-y-3">
                <div id="qr-reader" className="w-full rounded-lg overflow-hidden border bg-black"></div>
                <p className="text-sm text-center text-muted-foreground">
                  {isScanning ? "Point camera at QR code or barcode..." : "Starting camera..."}
                </p>
                <Button onClick={() => setScanMode("manual")} variant="outline" className="w-full">
                  Switch to Manual Entry
                </Button>
              </div>
            )}

            {/* Manual Entry */}
            {scanMode === "manual" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="assetTag">Asset Tag / Barcode</Label>
                  <Input
                    id="assetTag"
                    placeholder="Enter asset tag..."
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleScan();
                      }
                    }}
                    className="text-lg h-12"
                    autoFocus
                  />
                </div>
                <Button onClick={handleScan} className="w-full h-12 text-lg">
                  <Search className="h-5 w-5 mr-2" />
                  Find Asset
                </Button>
              </div>
            )}

            {/* Camera View Placeholder */}
            {scanMode === "camera" && (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Camera className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Camera scanning feature</p>
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scanned Asset Info */}
        {scannedAsset && (
          <>
            <Card className="border-green-500">
              <CardHeader className="bg-green-50 dark:bg-green-950">
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-5 w-5" />
                  Asset Found
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Asset Name</p>
                  <p className="text-lg font-semibold">{scannedAsset.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Asset Tag</p>
                    <p className="font-mono">{scannedAsset.assetTag}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <p className="capitalize">{scannedAsset.status}</p>
                  </div>
                </div>

                {scannedAsset.location && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Location</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p>{scannedAsset.location}</p>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => setLocation(`/assets/${scannedAsset.id}`)}
                  className="w-full"
                >
                  View Full Details
                </Button>
              </CardContent>
            </Card>

            {/* Quick Update Form */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Update</CardTitle>
                <CardDescription>
                  Update asset status and location
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={updateForm.status}
                    onValueChange={(value) =>
                      setUpdateForm({ ...updateForm, status: value })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operational">Operational</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="repair">Repair</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Enter new location..."
                    value={updateForm.location}
                    onChange={(e) =>
                      setUpdateForm({ ...updateForm, location: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add notes about this update..."
                    value={updateForm.notes}
                    onChange={(e) =>
                      setUpdateForm({ ...updateForm, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleQuickUpdate}
                    disabled={updateAssetMutation.isPending}
                    className="flex-1"
                  >
                    {updateAssetMutation.isPending ? "Updating..." : "Update Asset"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setScannedAsset(null);
                      setAssetTag("");
                      setUpdateForm({ status: "", location: "", notes: "" });
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Help Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scanner Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>• Enter the asset tag exactly as it appears on the label</p>
            <p>• Use the camera scan feature for barcode/QR code scanning (coming soon)</p>
            <p>• Update status and location quickly without navigating to full asset details</p>
            <p>• Notes are automatically timestamped and appended to asset history</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
