import { appPath } from "@/lib/routes";
import type { FacilitiesSegment } from "@/lib/facilityRoutes";
import { segmentToNewTypeQuery } from "@/lib/facilityRoutes";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { usePermissions } from "@/_core/hooks/usePermissions";

const TABS: { segment: FacilitiesSegment; label: string; path: string }[] = [
  { segment: "all", label: "All", path: "/facilities/all" },
  { segment: "national-hq", label: "National HQ", path: "/facilities/national-hq" },
  { segment: "branches", label: "Branches", path: "/facilities/branches" },
  { segment: "clinics", label: "Clinics", path: "/facilities/clinics" },
  { segment: "warehouses", label: "Warehouses", path: "/facilities/warehouses" },
];

type FacilitiesShellProps = {
  activeSegment: FacilitiesSegment;
  /** When false, tab strip is hidden (e.g. create flow still under facilities area). */
  showTabs?: boolean;
  children: React.ReactNode;
};

export function FacilitiesShell({
  activeSegment,
  showTabs = true,
  children,
}: FacilitiesShellProps) {
  const [location] = useLocation();
  const { canEditFacilities } = usePermissions();

  const addType = segmentToNewTypeQuery(activeSegment);
  const newHref =
    appPath("/facilities/new") + (addType ? `?type=${encodeURIComponent(addType)}` : "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Facilities Management</h1>
          <p className="mt-1 text-muted-foreground">Manage NRCS facilities</p>
        </div>
        {canEditFacilities ? (
          <Button className="h-9 shrink-0" asChild>
            <Link href={newHref} className="inline-flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Add Facility
            </Link>
          </Button>
        ) : null}
      </div>

      {showTabs ? (
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {TABS.map((t) => {
            const href = appPath(t.path);
            const loc = location.replace(/\/$/, "") || "/";
            const h = href.replace(/\/$/, "") || "/";
            const active = loc === h;
            return (
              <Link
                key={t.path}
                href={href}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      {children}
    </div>
  );
}
