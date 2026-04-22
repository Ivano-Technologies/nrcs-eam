import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

/**
 * Expand/collapse affordance for sidebar section headers.
 * Single shadcn-style pattern: chevron rotates 90° when open (LTR).
 */
export type GroupChevronDef = {
  Icon: LucideIcon;
  /** Tailwind rotate classes when the group is collapsed */
  collapsed: string;
  /** Tailwind rotate classes when the group is expanded */
  expanded: string;
};

/** One design for all collapsible groups in the sidebar. */
export const SIDEBAR_GROUP_CHEVRON: GroupChevronDef = {
  Icon: ChevronRight,
  collapsed: "",
  expanded: "rotate-90",
};

/** Trailing icon on nested nav links (same for every leaf). */
export const SIDEBAR_LEAF_TRAIL_ICON = ChevronRight;
