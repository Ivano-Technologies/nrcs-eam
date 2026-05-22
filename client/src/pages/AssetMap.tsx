import { useCallback, useEffect, useRef, useState } from "react";
import { MapView } from "@/components/Map";
import PageHeader from "@/components/ui/PageHeader";
import PageLoader from "@/components/ui/PageLoader";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM_COUNTRY } from "@/lib/mapDefaults";
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import {
  FACILITY_TYPE_VALUES,
  type FacilityType,
} from "@shared/facilities";
import { Map as MapIcon } from "lucide-react";

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

const ASSET_OVERLAY_COLOUR = "#F59E0B";

function parseCoord(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function facilityPosition(
  facility: { latitude: string | null; longitude: string | null }
): google.maps.LatLngLiteral | null {
  const lat = parseCoord(facility.latitude);
  const lng = parseCoord(facility.longitude);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

export default function AssetMap() {
  const [selectedFacilityType, setSelectedFacilityType] = useState<string>("all");
  const [showAssetOverlay, setShowAssetOverlay] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);
  const facilityMarkersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<
    { line: google.maps.Polyline; childId: number; parentId: number }[]
  >([]);
  const assetMarkersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const mapListenersAttachedRef = useRef(false);

  const mapData = trpc.sites.mapData.useQuery();
  const assets = trpc.assets.list.useQuery({}, { enabled: showAssetOverlay });

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

  const renderMap = useCallback(() => {
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

    const facilityById = new globalThis.Map(
      facilities.map((f) => [f.id, f] as const)
    );
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

      const facilityDetailHref = appPath(`/facilities/${facility.id}`);
      const infoHtml = `
        <div style="min-width:200px;font-family:sans-serif">
          <div style="font-weight:700;font-size:15px;margin-bottom:4px">${facility.name}</div>
          <div style="font-size:12px;color:#666;margin-bottom:8px">${FACILITY_LABELS[type]}</div>
          <div style="font-size:13px;margin-bottom:4px">Assets: <strong>${facility.assetCount}</strong></div>
          <div style="font-size:13px;margin-bottom:12px">Inventory items: <strong>${facility.inventoryCount}</strong></div>
          <a href="${facilityDetailHref}"
             style="display:inline-block;background:#DC2626;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;text-decoration:none;font-weight:600">
            View Details
          </a>
        </div>
      `;

      marker.addListener("click", () => {
        highlightPolylines(facility.id);
        infoWindowRef.current?.setContent(infoHtml);
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

        const assetHref = appPath(`/assets/${asset.id}`);
        const pinSource =
          asset.latitude && asset.longitude
            ? "Asset coordinates"
            : "Facility coordinates";
        const assetInfoHtml = `
          <div style="min-width:200px;font-family:sans-serif">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">${asset.name}</div>
            <div style="font-size:13px;margin-bottom:4px">Tag: <strong>${asset.assetTag ?? "—"}</strong></div>
            <div style="font-size:13px;margin-bottom:4px">Status: <strong>${asset.status}</strong></div>
            <div style="font-size:13px;margin-bottom:4px">Facility: <strong>${facility?.name ?? "N/A"}</strong></div>
            <div style="font-size:12px;color:#666;margin-bottom:12px">Pin: ${pinSource}</div>
            <a href="${assetHref}"
               style="display:inline-block;background:#DC2626;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;text-decoration:none;font-weight:600">
              View Asset
            </a>
          </div>
        `;

        marker.addListener("click", () => {
          infoWindowRef.current?.setContent(assetInfoHtml);
          infoWindowRef.current?.open({ map, anchor: marker });
        });

        assetMarkersRef.current.push(marker);
      }
    }

    if (facilitiesWithValidCoords > 0) {
      map.fitBounds(bounds);
      if (facilitiesWithValidCoords === 1) {
        map.setZoom(12);
      }
    } else {
      map.setCenter({ ...DEFAULT_MAP_CENTER });
      map.setZoom(DEFAULT_MAP_ZOOM_COUNTRY);
    }
  }, [
    mapData.data,
    showAssetOverlay,
    assets.data,
    selectedFacilityType,
    highlightPolylines,
  ]);

  const handleMapReady = useCallback(
    (googleMap: google.maps.Map) => {
      mapRef.current = googleMap;

      if (!infoWindowRef.current) {
        infoWindowRef.current = new google.maps.InfoWindow();
      }

      if (!mapListenersAttachedRef.current) {
        infoWindowRef.current.addListener("closeclick", () => {
          resetPolylines();
        });
        googleMap.addListener("click", () => {
          infoWindowRef.current?.close();
          resetPolylines();
        });
        mapListenersAttachedRef.current = true;
      }

      renderMap();
    },
    [renderMap, resetPolylines]
  );

  useEffect(() => {
    if (mapRef.current && mapData.data) {
      renderMap();
    }
  }, [mapData.data, showAssetOverlay, assets.data, selectedFacilityType, renderMap]);

  if (mapData.isLoading) return <PageLoader />;

  const totalFacilities = mapData.data?.length ?? 0;
  const facilitiesWithCoords =
    mapData.data?.filter((f) => facilityPosition(f) != null).length ?? 0;
  const missingCoords = totalFacilities - facilitiesWithCoords;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={MapIcon}
        title="Asset Map"
        subtitle="Geographic view of assets and facilities across Nigeria"
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
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

          <div className="flex items-center gap-2 pt-6">
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
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {facilitiesWithCoords} of {totalFacilities} facilities mapped
          </span>
          {missingCoords > 0 ? (
            <Badge
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            >
              {missingCoords} missing coordinates
            </Badge>
          ) : null}
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
        {FACILITY_TYPE_VALUES.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: FACILITY_COLOURS[type] }}
            />
            <span>{FACILITY_LABELS[type]}</span>
          </div>
        ))}
        {showAssetOverlay ? (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ASSET_OVERLAY_COLOUR }}
            />
            <span>Assets</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
