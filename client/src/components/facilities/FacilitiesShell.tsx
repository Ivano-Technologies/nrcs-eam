import { appPath } from "@/lib/routes";
import type { FacilitiesSegment } from "@/lib/facilityRoutes";
import { segmentToNewTypeQuery } from "@/lib/facilityRoutes";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
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

  const addType = segmentToNewTypeQuery(activeSegment);
  const newHref =
    appPath("/facilities/new") + (addType ? `?type=${encodeURIComponent(addType)}` : "");

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
