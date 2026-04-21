import { FacilitiesShell } from "@/components/facilities/FacilitiesShell";
import { FacilitiesPage } from "@/pages/Facilities";
import type { FacilitiesSegment } from "@/lib/facilityRoutes";

export function FacilitiesTabRoute({ segment }: { segment: FacilitiesSegment }) {
  return (
    <FacilitiesShell activeSegment={segment}>
      <FacilitiesPage segment={segment} />
    </FacilitiesShell>
  );
}
