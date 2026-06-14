import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { MapView } from "@/components/Map";
import PageHeader from "@/components/ui/PageHeader";
import PageLoader from "@/components/ui/PageLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM_COUNTRY } from "@/lib/mapDefaults";
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";
import {
  FACILITY_TYPE_VALUES,
  type FacilityType,
} from "@shared/facilities";
import type { inferRouterOutputs } from "@trpc/server";
import { Map as MapIcon, Search } from "lucide-react";
import {
  matchesStockTierForTest as matchesStockTier,
  stockPinColorForTest as stockPinColor,
  type StockTier,
} from "@/lib/facilityMapHelpers";

type SiteMapDataRow = inferRouterOutputs<AppRouter>["sites"]["mapData"][number];
type SiteNetworkRow = inferRouterOutputs<AppRouter>["sites"]["mapNetworkData"][number];

type MapViewMode = "assets" | "network";

const FACILITY_COLOURS: Record<FacilityType, string> = {
  national_headquarters: "#DC2626",
  division: "#EAB308",
  branch: "#EA580C",
  clinic: "#2563EB",
  warehouse: "#16A34A",
};

const FACILITY_LABELS: Record<FacilityType, string> = {
  national_headquarters: "NHQ",
  division: "Division",
  branch: "Branch",
  clinic: "Clinic",
  warehouse: "Warehouse",
};

const STOCK_COLOURS = {
  adequate: "#16A34A",
  partial: "#EAB308",
  low: "#DC2626",
  offline: "#9CA3AF",
} as const;

const ASSET_OVERLAY_COLOUR = "#F59E0B";

function parseCoord(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function facilityPosition(facility: {
  latitude: string | null;
  longitude: string | null;
}): google.maps.LatLngLiteral | null {
  const lat = parseCoord(facility.latitude);
  const lng = parseCoord(facility.longitude);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function buildAssetInfoWindow(
  facility: SiteMapDataRow,
  photoUrl: string | null
): string {
  const facilityDetailHref = appPath(`/facilities/${facility.id}`);
  return `
    <div style="min-width:220px;font-family:sans-serif;border-radius:8px;overflow:hidden">
      ${
        photoUrl
          ? `<div style="width:100%;height:140px;overflow:hidden;margin-bottom:10px;border-radius:6px">
          <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover" alt="Facility photo" />
        </div>`
          : ""
      }
      <div style="padding: ${photoUrl ? "0 4px 4px" : "4px"}">
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">${facility.name}</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px">${FACILITY_LABELS[facility.facilityType]}</div>
        <div style="font-size:13px;margin-bottom:4px">Assets: <strong>${facility.assetCount}</strong></div>
        <div style="font-size:13px;margin-bottom:12px">Inventory items: <strong>${facility.inventoryCount}</strong></div>
        <a href="${facilityDetailHref}" style="display:inline-block;background:#DC2626;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;text-decoration:none;font-weight:600">View Details</a>
      </div>
    </div>
  `;
}

export default function AssetMap() {
  const [viewMode, setViewMode] = useState<MapViewMode>("network");
  const [selectedFacilityType, setSelectedFacilityType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<StockTier>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAssetOverlay, setShowAssetOverlay] = useState(false);
  const [activeFacilityPhoto, setActiveFacilityPhoto] = useState<string | null>(null);
  const [activeFacilityId, setActiveFacilityId] = useState<number | null>(null);
  const [selectedNetworkFacility, setSelectedNetworkFacility] = useState<SiteNetworkRow | null>(
    null
  );
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const facilityMarkersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<
    { line: google.maps.Polyline; childId: number; parentId: number }[]
  >([]);
  const assetMarkersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const mapListenersAttachedRef = useRef(false);

  const mapData = trpc.sites.mapData.useQuery(undefined, { enabled: viewMode === "assets" });
  const networkData = trpc.sites.mapNetworkData.useQuery(undefined, {
    enabled: viewMode === "network",
  });
  const assets = trpc.assets.list.useQuery({}, { enabled: showAssetOverlay && viewMode === "assets" });
  const facilityPhotosQuery = trpc.facilityPhotos.list.useQuery(
    { siteId: activeFacilityId! },
    { enabled: activeFacilityId !== null && viewMode === "assets" }
  );

  const isLoading = viewMode === "assets" ? mapData.isLoading : networkData.isLoading;

  const filteredNetwork = useMemo(() => {
    const rows = networkData.data ?? [];
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((f) => {
      if (selectedFacilityType !== "all" && f.facilityType !== selectedFacilityType) return false;
      if (statusFilter === "active" && !f.isActive) return false;
      if (statusFilter === "inactive" && f.isActive) return false;
      if (!matchesStockTier(f, stockFilter)) return false;
      if (q) {
        const hay = `${f.name} ${f.code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [networkData.data, selectedFacilityType, statusFilter, stockFilter, searchQuery]);

  useEffect(() => {
    if (facilityPhotosQuery.data?.length) {
      setActiveFacilityPhoto(facilityPhotosQuery.data[0].photoUrl);
    } else {
      setActiveFacilityPhoto(null);
    }
  }, [facilityPhotosQuery.data]);

  useEffect(() => {
    if (infoWindowRef.current && activeFacilityId !== null && mapRef.current && viewMode === "assets") {
      const facility = mapData.data?.find((f) => f.id === activeFacilityId);
      if (facility) {
        infoWindowRef.current.setContent(buildAssetInfoWindow(facility, activeFacilityPhoto));
      }
    }
  }, [activeFacilityPhoto, activeFacilityId, mapData.data, viewMode]);

  const resetPolylines = useCallback(() => {
    polylinesRef.current.forEach(({ line }) => {
      line.setOptions({
        strokeColor: "#9CA3AF",
        strokeOpacity: 0.15,
        strokeWeight: 1.5,
      });
    });
  }, []);

  const highlightPolylines = useCallback(
    (facilityId: number) => {
      resetPolylines();
      polylinesRef.current.forEach(({ line, childId, parentId }) => {
        if (childId === facilityId || parentId === facilityId) {
          line.setOptions({
            strokeColor: "#DC2626",
            strokeOpacity: 0.85,
            strokeWeight: 3,
          });
        }
      });
    },
    [resetPolylines]
  );

  const renderNetworkMap = useCallback(() => {
    const map = mapRef.current;
    const facilities = filteredNetwork;
    if (!map) return;

    facilityMarkersRef.current.forEach((m) => m.setMap(null));
    facilityMarkersRef.current = [];
    polylinesRef.current.forEach(({ line }) => line.setMap(null));
    polylinesRef.current = [];
    assetMarkersRef.current.forEach((m) => m.setMap(null));
    assetMarkersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let plotted = 0;

    for (const facility of facilities) {
      const position = facilityPosition(facility);
      if (!position) continue;
      plotted += 1;

      const fillColor = stockPinColor(facility);
      const isHighlight = highlightId === facility.id;
      const marker = new google.maps.Marker({
        position,
        map,
        title: facility.name,
        label: facility.code
          ? { text: facility.code.slice(0, 6), color: "#fff", fontSize: "9px", fontWeight: "600" }
          : undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isHighlight ? 16 : 12,
          fillColor,
          fillOpacity: 1,
          strokeColor: isHighlight ? "#1d4ed8" : "#ffffff",
          strokeWeight: isHighlight ? 3 : 2,
        },
        zIndex: isHighlight ? 300 : facility.facilityType === "national_headquarters" ? 200 : 100,
      });

      marker.addListener("click", () => {
        setSelectedNetworkFacility(facility);
        setHighlightId(facility.id);
        map.panTo(position);
        if (map.getZoom() != null && map.getZoom()! < 8) map.setZoom(8);
      });

      facilityMarkersRef.current.push(marker);
      bounds.extend(position);
    }

    if (plotted > 0) {
      map.fitBounds(bounds);
      if (plotted === 1) map.setZoom(12);
    } else {
      map.setCenter({ ...DEFAULT_MAP_CENTER });
      map.setZoom(DEFAULT_MAP_ZOOM_COUNTRY);
    }
  }, [filteredNetwork, highlightId]);

  const renderAssetsMap = useCallback(() => {
    const map = mapRef.current;
    const facilities = mapData.data;
    if (!map || !facilities) return;

    facilityMarkersRef.current.forEach((m) => m.setMap(null));
    facilityMarkersRef.current = [];
    polylinesRef.current.forEach(({ line }) => line.setMap(null));
    polylinesRef.current = [];
    assetMarkersRef.current.forEach((m) => m.setMap(null));
    assetMarkersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    const facilityById = new globalThis.Map(facilities.map((f) => [f.id, f] as const));
    const bounds = new google.maps.LatLngBounds();
    let facilitiesWithValidCoords = 0;

    for (const facility of facilities) {
      const position = facilityPosition(facility);
      if (!position) continue;
      facilitiesWithValidCoords += 1;
      const type = facility.facilityType;

      const marker = new google.maps.Marker({
        position,
        map,
        title: facility.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: type === "national_headquarters" ? 16 : 12,
          fillColor: FACILITY_COLOURS[type],
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: type === "national_headquarters" ? 200 : 100,
      });

      if (selectedFacilityType !== "all" && type !== selectedFacilityType) {
        marker.setOpacity(0.2);
      } else {
        marker.setOpacity(1);
      }

      marker.addListener("click", () => {
        highlightPolylines(facility.id);
        setActiveFacilityId(facility.id);
        setActiveFacilityPhoto(null);
        infoWindowRef.current?.setContent(buildAssetInfoWindow(facility, null));
        infoWindowRef.current?.open({ map, anchor: marker });
      });

      facilityMarkersRef.current.push(marker);
      bounds.extend(position);
    }

    for (const facility of facilities) {
      if (facility.parentFacilityId == null) continue;
      const parent = facilityById.get(facility.parentFacilityId);
      if (!parent) continue;
      const childPos = facilityPosition(facility);
      const parentPos = facilityPosition(parent);
      if (!childPos || !parentPos) continue;

      const line = new google.maps.Polyline({
        map,
        path: [childPos, parentPos],
        strokeColor: "#9CA3AF",
        strokeOpacity: 0.15,
        strokeWeight: 1.5,
        zIndex: 10,
      });
      polylinesRef.current.push({
        line,
        childId: facility.id,
        parentId: facility.parentFacilityId,
      });
    }

    if (showAssetOverlay && assets.data) {
      for (const asset of assets.data) {
        const facility = facilityById.get(asset.siteId);
        const latStr = asset.latitude ?? facility?.latitude ?? null;
        const lngStr = asset.longitude ?? facility?.longitude ?? null;
        const lat = parseCoord(latStr);
        const lng = parseCoord(lngStr);
        if (lat == null || lng == null) continue;

        const position = { lat, lng };
        const marker = new google.maps.Marker({
          position,
          map,
          title: asset.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: ASSET_OVERLAY_COLOUR,
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
          },
          zIndex: 50,
        });
        assetMarkersRef.current.push(marker);
      }
    }

    if (facilitiesWithValidCoords > 0) {
      map.fitBounds(bounds);
      if (facilitiesWithValidCoords === 1) map.setZoom(12);
    } else {
      map.setCenter({ ...DEFAULT_MAP_CENTER });
      map.setZoom(DEFAULT_MAP_ZOOM_COUNTRY);
    }
  }, [mapData.data, showAssetOverlay, assets.data, selectedFacilityType, highlightPolylines]);

  const renderMap = useCallback(() => {
    if (viewMode === "network") renderNetworkMap();
    else renderAssetsMap();
  }, [viewMode, renderNetworkMap, renderAssetsMap]);

  const handleMapReady = useCallback(
    (googleMap: google.maps.Map) => {
      mapRef.current = googleMap;
      if (!infoWindowRef.current) {
        infoWindowRef.current = new google.maps.InfoWindow();
      }
      if (!mapListenersAttachedRef.current && viewMode === "assets") {
        infoWindowRef.current.addListener("closeclick", () => {
          resetPolylines();
          setActiveFacilityId(null);
          setActiveFacilityPhoto(null);
        });
        googleMap.addListener("click", () => {
          infoWindowRef.current?.close();
          resetPolylines();
          setActiveFacilityId(null);
          setActiveFacilityPhoto(null);
        });
        mapListenersAttachedRef.current = true;
      }
      renderMap();
    },
    [renderMap, resetPolylines, viewMode]
  );

  useEffect(() => {
    if (mapRef.current) renderMap();
  }, [renderMap]);

  useEffect(() => {
    if (!searchQuery.trim() || viewMode !== "network") return;
    const match = filteredNetwork.find((f) => facilityPosition(f));
    if (match && mapRef.current) {
      const pos = facilityPosition(match);
      if (pos) {
        setHighlightId(match.id);
        mapRef.current.panTo(pos);
        mapRef.current.setZoom(10);
      }
    }
  }, [searchQuery, filteredNetwork, viewMode]);

  if (isLoading) return <PageLoader />;

  const totalFacilities =
    viewMode === "network" ? (networkData.data?.length ?? 0) : (mapData.data?.length ?? 0);
  const facilitiesWithCoords =
    viewMode === "network"
      ? (networkData.data?.filter((f) => facilityPosition(f) != null).length ?? 0)
      : (mapData.data?.filter((f) => facilityPosition(f) != null).length ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={MapIcon}
        title="Asset Map"
        subtitle="Geographic view of facilities — network stock readiness or asset overlay"
      />

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as MapViewMode)}>
        <TabsList>
          <TabsTrigger value="network" data-testid="asset-map-network-tab">
            Facility Network
          </TabsTrigger>
          <TabsTrigger value="assets" data-testid="asset-map-assets-tab">
            Assets
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search facility name or code…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="asset-map-search"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-medium">Facility type</Label>
          <Select value={selectedFacilityType} onValueChange={setSelectedFacilityType}>
            <SelectTrigger className="w-[180px]" data-testid="asset-map-facility-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {FACILITY_TYPE_VALUES.map((type) => (
                <SelectItem key={type} value={type}>
                  {FACILITY_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {viewMode === "network" ? (
          <>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="asset-map-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Stock readiness</Label>
              <Select
                value={stockFilter}
                onValueChange={(v) => setStockFilter(v as StockTier)}
              >
                <SelectTrigger className="w-[160px]" data-testid="asset-map-stock-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="adequate">Adequate (≥75%)</SelectItem>
                  <SelectItem value="partial">Partial (50–74%)</SelectItem>
                  <SelectItem value="low">Low (&lt;50%)</SelectItem>
                  <SelectItem value="none">No data</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 pb-1">
            <Switch
              id="show-assets"
              checked={showAssetOverlay}
              onCheckedChange={setShowAssetOverlay}
              data-testid="asset-map-show-assets"
            />
            <Label htmlFor="show-assets" className="cursor-pointer text-sm font-medium">
              Show Assets
            </Label>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2 pb-1">
          <span className="text-sm text-muted-foreground">
            {viewMode === "network" ? filteredNetwork.length : facilitiesWithCoords} of{" "}
            {totalFacilities} facilities
            {viewMode === "network" ? " shown" : " mapped"}
          </span>
        </div>
      </div>

      <div
        className="min-h-[600px] w-full overflow-hidden rounded-lg border bg-muted/30"
        data-testid="asset-map-panel"
      >
        <MapView
          initialCenter={{ ...DEFAULT_MAP_CENTER }}
          initialZoom={DEFAULT_MAP_ZOOM_COUNTRY}
          onMapReady={handleMapReady}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        {viewMode === "network" ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: STOCK_COLOURS.adequate }} />
              <span>Adequate (≥75%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: STOCK_COLOURS.partial }} />
              <span>Partial</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: STOCK_COLOURS.low }} />
              <span>Low stock</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: STOCK_COLOURS.offline }} />
              <span>Inactive / no data</span>
            </div>
          </>
        ) : (
          FACILITY_TYPE_VALUES.map((type) => (
            <div key={type} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: FACILITY_COLOURS[type] }}
              />
              <span>{FACILITY_LABELS[type]}</span>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={selectedNetworkFacility != null}
        onOpenChange={(open) => {
          if (!open) setSelectedNetworkFacility(null);
        }}
      >
        <DialogContent>
          {selectedNetworkFacility ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedNetworkFacility.name}</DialogTitle>
                <DialogDescription>
                  {selectedNetworkFacility.code ? `${selectedNetworkFacility.code} · ` : ""}
                  {FACILITY_LABELS[selectedNetworkFacility.facilityType]}
                  {!selectedNetworkFacility.isActive ? " · Inactive" : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                {(selectedNetworkFacility.address || selectedNetworkFacility.city) && (
                  <p>
                    {[selectedNetworkFacility.address, selectedNetworkFacility.city, selectedNetworkFacility.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                <p>
                  Stock readiness:{" "}
                  <strong>
                    {selectedNetworkFacility.stockScorePercent != null
                      ? `${selectedNetworkFacility.stockScorePercent}%`
                      : "—"}
                  </strong>{" "}
                  ({selectedNetworkFacility.adequateCards}/{selectedNetworkFacility.totalCards} cards
                  adequate)
                </p>
                {selectedNetworkFacility.lastMovementDate ? (
                  <p className="text-muted-foreground">
                    Last movement: {selectedNetworkFacility.lastMovementDate}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedNetworkFacility(null)}>
                  Close
                </Button>
                <Button asChild>
                  <Link href={appPath(`/facilities/${selectedNetworkFacility.id}`)}>
                    View Full Details
                  </Link>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
