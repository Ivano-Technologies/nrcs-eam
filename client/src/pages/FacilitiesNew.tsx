import { FacilitiesShell } from "@/components/facilities/FacilitiesShell";
import { FacilitiesPage } from "@/pages/Facilities";

export default function FacilitiesNew() {
  return (
    <FacilitiesShell activeSegment="all">
      <FacilitiesPage segment="all" autoOpenCreate />
    </FacilitiesShell>
  );
}
