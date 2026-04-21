import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsRight,
  ChevronsUp,
  ChevronsUpDown,
  CircleChevronDown,
  CircleChevronRight,
  SquareChevronRight,
} from "lucide-react";

/**
 * Expand/collapse affordance per sidebar section — distinct shapes help scan groups quickly.
 * Aligned with common shadcn / 21st-style sidebar patterns: chevron rotates on open (LTR).
 */
export type GroupChevronDef = {
  Icon: LucideIcon;
  /** Tailwind rotate classes when the group is collapsed */
  collapsed: string;
  /** Tailwind rotate classes when the group is expanded */
  expanded: string;
};

export const GROUP_HEADER_CHEVRONS: Record<string, GroupChevronDef> = {
  assets: {
    Icon: ChevronRight,
    collapsed: "",
    expanded: "rotate-90",
  },
  facilities: {
    Icon: ChevronDown,
    collapsed: "-rotate-90",
    expanded: "rotate-0",
  },
  inventory: {
    Icon: ChevronsRight,
    collapsed: "",
    expanded: "rotate-90",
  },
  maintenance: {
    Icon: ChevronsDown,
    collapsed: "-rotate-90",
    expanded: "rotate-0",
  },
  finance: {
    Icon: CircleChevronRight,
    collapsed: "",
    expanded: "rotate-90",
  },
  compliance: {
    Icon: CircleChevronDown,
    collapsed: "-rotate-90",
    expanded: "rotate-0",
  },
  reports: {
    Icon: SquareChevronRight,
    collapsed: "",
    expanded: "rotate-90",
  },
  administration: {
    Icon: ChevronFirst,
    collapsed: "",
    expanded: "rotate-180",
  },
};

export const DEFAULT_GROUP_CHEVRON: GroupChevronDef = GROUP_HEADER_CHEVRONS.assets;

/** Small trailing icons for leaf links — cycles so neighbours in a list differ where possible. */
const SUB_TRAIL_ICONS: LucideIcon[] = [
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronsRight,
  ChevronsDown,
  ChevronsUp,
  CircleChevronRight,
  CircleChevronDown,
  SquareChevronRight,
  ChevronFirst,
  ChevronLast,
  ChevronsUpDown,
];

export function subTrailIconForIndex(index: number): LucideIcon {
  return SUB_TRAIL_ICONS[index % SUB_TRAIL_ICONS.length]!;
}
