import type { FacilitiesSegment } from "@/lib/facilityRoutes";
import { segmentToNewTypeQuery } from "@/lib/facilityRoutes";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useSearch } from "wouter";
import PageHeader from "@/components/ui/PageHeader";
import { Building2, Plus } from "lucide-react";
import { usePermissions } from "@/_core/hooks/usePermissions";

type FacilitiesShellProps = {
  activeSegment: FacilitiesSegment;
  children: React.ReactNode;
};

export function FacilitiesShell({
  activeSegment,
  children,
}: FacilitiesShellProps) {
  const { canEditFacilities } = usePermissions();

  const [location] = useLocation();
  const search = useSearch();
  // Add opens the dialog in place (?new=1) so the page keeps its view and the sidebar fold.
  const addType = segmentToNewTypeQuery(activeSegment);
  const params = new URLSearchParams(search);
  params.set("new", "1");
  if (addType) params.set("type", addType);
  else params.delete("type");
  const newHref = `${location}?${params.toString()}`;

  return (
    <div>
      <PageHeader
        icon={Building2}
        title="Facilities"
        subtitle="NRCS facilities across Nigeria, by type, state and status."
        actions={
          canEditFacilities ? (
            <Button className="h-9 shrink-0" asChild>
              <Link href={newHref} className="inline-flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Add facility
              </Link>
            </Button>
          ) : null
        }
      />

      {children}
    </div>
  );
}
