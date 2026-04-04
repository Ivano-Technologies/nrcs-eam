import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapView } from "@/components/Map";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from "lucide-react";

export default function AssetMap() {
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [siteMarkers, setSiteMarkers] = useState<google.maps.Marker[]>([]);

  const { data: assets, isLoading } = trpc.assets.list.useQuery({});
  const { data: sites } = trpc.sites.list.useQuery();
  const { data: categories } = trpc.assetCategories.list.useQuery();

  const handleMapReady = (googleMap: google.maps.Map) => {
    setMap(googleMap);
    
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);
    siteMarkers.forEach(marker => marker.setMap(null));
    setSiteMarkers([]);

    // Add site markers first
    const newSiteMarkers: google.maps.Marker[] = [];
    if (sites) {
      sites.forEach(site => {
        // Use default Nigeria coordinates if site doesn't have specific location
        const lat = site.latitude ? parseFloat(site.latitude) : 9.0820 + (Math.random() - 0.5) * 2;
        const lng = site.longitude ? parseFloat(site.longitude) : 8.6753 + (Math.random() - 0.5) * 2;
        const position = { lat, lng };

        const siteMarker = new google.maps.Marker({
          position,
          map: googleMap,
          title: site.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#DC2626", // Red for sites
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 3,
          },
          zIndex: 100, // Sites appear above assets
        });

        const siteInfoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; max-width: 280px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #DC2626;">📍 ${site.name}</h3>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Address:</strong> ${site.address || 'N/A'}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>City:</strong> ${site.city || 'N/A'}, ${site.state || 'N/A'}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Contact:</strong> ${site.contactPerson || 'N/A'}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Phone:</strong> ${site.contactPhone || 'N/A'}</p>
              <a href="/sites" style="display: inline-block; margin-top: 8px; color: #DC2626; text-decoration: none; font-weight: 500;">View All Sites →</a>
            </div>
          `,
        });

        // Show info on hover
        siteMarker.addListener("mouseover", () => {
          siteInfoWindow.open(googleMap, siteMarker);
        });

        siteMarker.addListener("mouseout", () => {
          siteInfoWindow.close();
        });

        // Also show on click
        siteMarker.addListener("click", () => {
          siteInfoWindow.open(googleMap, siteMarker);
        });

        newSiteMarkers.push(siteMarker);
      });
    }
    setSiteMarkers(newSiteMarkers);

    if (!assets || assets.length === 0) return;

    // Filter assets based on selection
    const filteredAssets = assets.filter(asset => {
      const siteMatch = selectedSite === "all" || asset.siteId === parseInt(selectedSite);
      const categoryMatch = selectedCategory === "all" || asset.categoryId === parseInt(selectedCategory);
      return siteMatch && categoryMatch && asset.latitude && asset.longitude;
    });

    if (filteredAssets.length === 0) {
      // Center on Nigeria if no assets with coordinates
      googleMap.setCenter({ lat: 9.0820, lng: 8.6753 });
      googleMap.setZoom(6);
      return;
    }

    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();

    // Add site positions to bounds
    newSiteMarkers.forEach(marker => {
      const pos = marker.getPosition();
      if (pos) bounds.extend(pos);
    });

    filteredAssets.forEach(asset => {
      if (!asset.latitude || !asset.longitude) return;

      const lat = parseFloat(asset.latitude);
      const lng = parseFloat(asset.longitude);
      const position = { lat, lng };

      const marker = new google.maps.Marker({
        position,
        map: googleMap,
        title: asset.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#DC2626", // Red for assets
          fillOpacity: 0.9,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
        zIndex: 50, // Assets below sites
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 250px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${asset.name}</h3>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Tag:</strong> ${asset.assetTag}</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Status:</strong> ${asset.status}</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Location:</strong> ${asset.location || 'N/A'}</p>
            <a href="/assets/${asset.id}" style="display: inline-block; margin-top: 8px; color: #DC2626; text-decoration: none; font-weight: 500;">View Details →</a>
          </div>
        `,
      });

      // Show info on hover
      marker.addListener("mouseover", () => {
        infoWindow.open(googleMap, marker);
      });

      marker.addListener("mouseout", () => {
        infoWindow.close();
      });

      // Also show on click
      marker.addListener("click", () => {
        infoWindow.open(googleMap, marker);
      });

      newMarkers.push(marker);
      bounds.extend(position);
    });

    setMarkers(newMarkers);

    // Fit map to show all markers (sites + assets)
    if (newMarkers.length > 0 || newSiteMarkers.length > 0) {
      googleMap.fitBounds(bounds);
      if (newMarkers.length + newSiteMarkers.length === 1) {
        googleMap.setZoom(15);
      }
    } else {
      // Center on Nigeria if no markers
      googleMap.setCenter({ lat: 9.0820, lng: 8.6753 });
      googleMap.setZoom(6);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "operational":
        return "#22C55E"; // green
      case "maintenance":
        return "#F59E0B"; // orange
      case "repair":
        return "#EF4444"; // red
      case "retired":
        return "#9CA3AF"; // gray
      case "disposed":
        return "#6B7280"; // dark gray
      default:
        return "#3B82F6"; // blue
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const assetsWithCoordinates = assets?.filter(a => a.latitude && a.longitude) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Asset Map</h1>
          <p className="text-muted-foreground mt-2">
            Track asset locations across NRCS sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {assetsWithCoordinates.length} assets mapped
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Site</label>
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger>
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites?.map((site) => (
                  <SelectItem key={site.id} value={site.id.toString()}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={() => {
                if (map) handleMapReady(map);
              }}
            >
              <Navigation className="mr-2 h-4 w-4" />
              Update Map
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Map View</CardTitle>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Operational</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-sm">Maintenance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm">Repair</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] w-full rounded-lg overflow-hidden border">
            <MapView 
              initialCenter={{ lat: 9.0820, lng: 8.6753 }} 
              initialZoom={6}
              onMapReady={handleMapReady} 
            />
          </div>
        </CardContent>
      </Card>

      {assetsWithCoordinates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Assets with Coordinates</h3>
            <p className="text-muted-foreground">
              Add GPS coordinates to assets to see them on the map
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
