import { Image as ImageIcon } from "lucide-react";
import type React from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import PageLoader from "@/components/ui/PageLoader";
import PageHeader from "@/components/ui/PageHeader";
import { formatDate, formatEmpty, formatEnumLabel } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PhotoUploadZone from "@/components/PhotoUploadZone";
import { appPath } from "@/lib/routes";
import { Link, useRoute } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CardQrCode } from "@/components/CardQrCode";
import { FACILITY_TYPE_DESCRIPTIONS, FACILITY_TYPE_LABELS } from "@shared/facilities";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { toast } from "sonner";
import { toastError, UserFacingError } from "@/lib/friendlyError";
import { Edit2, ExternalLink, Loader2, MapPin, X } from "lucide-react";

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE_MB = 5;

export default function FacilityDetail() {
  const { isManagerOrAdmin } = usePermissions();
  const [match, params] = useRoute("/app/facilities/:id");
  const id = match ? Number(params.id) : NaN;
  const enabled = Number.isFinite(id);
  const { data: facility } = trpc.sites.getById.useQuery({ id }, { enabled });
  const { data: allFacilities } = trpc.sites.list.useQuery(undefined, { enabled });
  const { data: assets } = trpc.assets.list.useQuery({ siteId: id }, { enabled });
  const { data: inventory } = trpc.inventory.list.useQuery({ siteId: id }, { enabled });
  const { data: workOrders } = trpc.workOrders.list.useQuery({ siteId: id }, { enabled });
  const { data: movements } = trpc.inventory.movements.useQuery({ siteId: id }, { enabled });
  const { data: transfers } = trpc.transfers.list.useQuery({ siteId: id }, { enabled });
  const photosQuery = trpc.facilityPhotos.list.useQuery(
    { siteId: id },
    { enabled: !!id }
  );

  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [deletePhotoId, setDeletePhotoId] = useState<number | null>(null);

  const uploadMutation = trpc.facilityPhotos.upload.useMutation({
    onSuccess: () => photosQuery.refetch(),
  });
  const deleteMutation = trpc.facilityPhotos.delete.useMutation({
    onSuccess: () => {
      photosQuery.refetch();
      setDeletePhotoId(null);
      toast.success("Photo deleted");
    },
    onError: (e) => toastError(e, "We couldn't delete the photo. Please try again."),
  });
  const uploadUrlMutation = trpc.facilityPhotos.uploadUrl.useMutation();

  const utils = trpc.useUtils();
  const syncCoordsMutation = trpc.assets.syncCoordinatesForSite.useMutation({
    onSuccess: (res) => {
      toast.success(`Updated coordinates on ${res.updated} asset(s) at this facility.`);
      void utils.assets.list.invalidate();
    },
    onError: (e) => toastError(e, "We couldn't sync. Please try again."),
  });

  const photoCount = photosQuery.data?.length ?? 0;
  const remainingPhotoSlots = MAX_PHOTOS - photoCount;
  const canUploadPhotos = isManagerOrAdmin && remainingPhotoSlots > 0;

  const childFacilities = useMemo(
    () => (allFacilities ?? []).filter((f) => f.parentFacilityId === id),
    [allFacilities, id]
  );

  const recentWorkOrders = useMemo(
    () =>
      [...(workOrders ?? [])]
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 5),
    [workOrders]
  );
  const recentMovements = useMemo(
    () =>
      [...(movements ?? [])]
        .sort((a, b) => +new Date(b.transactionDate) - +new Date(a.transactionDate))
        .slice(0, 5),
    [movements]
  );
  const recentTransfers = useMemo(
    () =>
      [...(transfers ?? [])]
        .sort((a, b) => +new Date(b.requestDate) - +new Date(a.requestDate))
        .slice(0, 5),
    [transfers]
  );

  const handlePhotoUpload = async (files: File[], caption?: string) => {
    const file = files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new UserFacingError(`${file.name} is larger than ${MAX_FILE_SIZE_MB}MB. Please choose a smaller photo.`);
    }

    setUploading(true);
    try {
      const { uploadUrl, photoKey, publicUrl } = await uploadUrlMutation.mutateAsync({
        siteId: id,
        fileName: file.name,
        fileType: file.type,
      });

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) {
        throw new UserFacingError(`We couldn't upload ${file.name}. Please try again.`);
      }

      await uploadMutation.mutateAsync({
        siteId: id,
        photoUrl: publicUrl,
        photoKey,
        caption,
      });
    } finally {
      setUploading(false);
    }
  };

  if (!enabled) return <div className="text-sm text-muted-foreground">Invalid facility id.</div>;
  if (!facility) return <PageLoader />;

  const lat = facility.latitude ? Number(facility.latitude) : NaN;
  const lng = facility.longitude ? Number(facility.longitude) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const mapsHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [facility.address, facility.city, facility.state].filter(Boolean).join(" ")
      )}`;
  const details: Array<[string, React.ReactNode]> = [
    ["Code", formatEmpty(facility.code)],
    ["Status", facility.isActive ? "Active" : "Inactive"],
    ["Address", formatEmpty(facility.address)],
    ["State", formatEmpty(facility.state)],
    ["Postal code", formatEmpty(facility.postalCode)],
    ["Contact", formatEmpty(facility.contactPerson)],
    ["Phone", formatEmpty(facility.contactPhone)],
  ];
  const activeWorkOrders = (workOrders ?? []).filter((w) => w.status !== "completed" && w.status !== "cancelled").length;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ label: "Facilities", href: appPath("/facilities/all") }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {facility.name}
            {/* Skip the type badge when the name already says it (e.g. "National Headquarters"). */}
            {facility.name.toLowerCase().includes(FACILITY_TYPE_LABELS[facility.facilityType].toLowerCase()) ? null : (
              <Badge variant="outline" className="text-sm font-medium">
                {FACILITY_TYPE_LABELS[facility.facilityType]}
              </Badge>
            )}
          </span>
        }
        subtitle={FACILITY_TYPE_DESCRIPTIONS[facility.facilityType]}
        actions={
          isManagerOrAdmin ? (
            <>
              <Button asChild size="sm" data-testid="facility-edit">
                <Link href={`${appPath("/facilities/all")}?edit=${facility.id}`}>
                  <Edit2 className="mr-2 h-4 w-4" aria-hidden />
                  Edit
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={syncCoordsMutation.isPending}
                onClick={() => syncCoordsMutation.mutate({ siteId: facility.id })}
              >
                {syncCoordsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" aria-hidden />
                )}
                Sync asset coordinates
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Facility details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <dl className="grid flex-1 grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
                <dt className="text-muted-foreground">Location</dt>
                <dd>
                  <a
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {hasCoords ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "View on Google Maps"}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </dd>
              </dl>
              <CardQrCode
                title={facility.name}
                subtitle={facility.code ?? FACILITY_TYPE_LABELS[facility.facilityType]}
                idValue={String(facility.id)}
                encodedValue={`${window.location.origin}${appPath(`/facilities/${facility.id}`)}`}
              />
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader><CardTitle>Statistics</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <StatLink label="Assets" value={assets?.length ?? 0} href={`${appPath("/assets")}?siteId=${facility.id}`} />
              <StatLink
                label="Inventory items"
                value={inventory?.length ?? 0}
                href={
                  facility.facilityType === "warehouse"
                    ? `${appPath("/inventory/stock-overview")}?siteId=${facility.id}`
                    : appPath("/inventory/stock-overview")
                }
              />
              <StatLink label="Active work orders" value={activeWorkOrders} href={`${appPath("/work-orders")}?siteId=${facility.id}`} />
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader><CardTitle>Child facilities</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {childFacilities.length === 0 ? (
                <p className="text-muted-foreground">No child facilities.</p>
              ) : (
                <ul className="divide-y">
                  {childFacilities.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={appPath(`/facilities/${c.id}`)} className="font-medium text-primary underline-offset-4 hover:underline">
                        {c.name}
                      </Link>
                      <Badge variant="outline">{FACILITY_TYPE_LABELS[c.facilityType]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="gap-4">
            <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <section>
                <h3 className="mb-1 font-medium">Asset movements</h3>
                {recentTransfers.length === 0 ? (
                  <p className="text-muted-foreground">No recent asset movements.</p>
                ) : (
                  <ul className="space-y-1">
                    {recentTransfers.map((t) => (
                      <li key={t.id}>{formatEnumLabel(t.status)} transfer #{t.id}, {formatDate(t.requestDate)}</li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-1 font-medium">Work orders</h3>
                {recentWorkOrders.length === 0 ? (
                  <p className="text-muted-foreground">No recent work orders.</p>
                ) : (
                  <ul className="space-y-1">
                    {recentWorkOrders.map((w) => (
                      <li key={w.id}>
                        <Link href={appPath(`/work-orders/${w.id}`)} className="text-primary underline-offset-4 hover:underline">
                          {w.workOrderNumber}
                        </Link>{" "}
                        {w.title}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-1 font-medium">Inventory transactions</h3>
                {recentMovements.length === 0 ? (
                  <p className="text-muted-foreground">No recent inventory transactions.</p>
                ) : (
                  <ul className="space-y-1">
                    {recentMovements.map((m, i) => (
                      <li key={`${m.itemCode}-${i}`}>{m.itemCode}: {formatEnumLabel(m.type)} {m.quantity} ({formatDate(m.transactionDate)})</li>
                    ))}
                  </ul>
                )}
              </section>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>
                Photos
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({photoCount}/{MAX_PHOTOS})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUploadPhotos && (
                <PhotoUploadZone
                  maxFiles={remainingPhotoSlots}
                  maxFileSizeMb={MAX_FILE_SIZE_MB}
                  disabled={uploading}
                  uploading={uploading}
                  onUpload={handlePhotoUpload}
                />
              )}
              {photosQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>Loading photos…</span>
                </div>
              ) : photosQuery.data?.length === 0 ? (
                <EmptyState icon={ImageIcon} title="No photos yet" className="py-6" />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photosQuery.data?.map((photo) => (
                    <div key={photo.id} className="space-y-1">
                      <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                        <button
                          type="button"
                          className="h-full w-full"
                          aria-label={`Open ${photo.caption ?? "facility photo"}`}
                          onClick={() => setSelectedPhoto(photo.photoUrl)}
                        >
                          <img
                            src={photo.photoUrl}
                            alt={photo.caption ?? "Facility photo"}
                            className="h-full w-full object-cover transition-opacity hover:opacity-80"
                          />
                        </button>
                        {isManagerOrAdmin && (
                          <button
                            type="button"
                            aria-label={`Delete ${photo.caption ?? "photo"}`}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setDeletePhotoId(photo.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                      {photo.caption && <p className="truncate px-0.5 text-xs text-muted-foreground">{photo.caption}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deletePhotoId !== null} onOpenChange={(open) => !open && setDeletePhotoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the photo from this facility. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletePhotoId !== null) deleteMutation.mutate({ id: deletePhotoId });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={selectedPhoto !== null} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Facility photo</DialogTitle>
          <DialogDescription className="sr-only">Press Esc to close.</DialogDescription>
          {selectedPhoto ? (
            <img src={selectedPhoto} alt="Facility photo" className="max-h-[90vh] w-full rounded-md object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatLink({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-md border p-3 hover:bg-muted/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </Link>
  );
}
