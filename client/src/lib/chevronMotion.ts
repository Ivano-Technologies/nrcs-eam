/**
 * Shared motion for chevrons that rotate when a control opens (accordion, sidebar, select, etc.).
 * Use with Tailwind state classes like `rotate-90`, `data-[state=open]:rotate-180`, or group triggers.
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html — respect reduced motion.
 */
export const chevronClickTransformClasses =
  "origin-center transition-transform duration-300 ease-out motion-reduce:transition-none";

/** Slightly snappier variant for small inline icons (e.g. scroll buttons). */
export const chevronClickTransformClassesSm =
  "origin-center transition-transform duration-200 ease-out motion-reduce:transition-none";
