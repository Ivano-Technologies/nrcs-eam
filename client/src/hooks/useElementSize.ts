import { useLayoutEffect, useState } from "react";

/** Quiet period after the last resize before a size counts as settled (longer than the 200ms sidebar slide). */
export const ELEMENT_SIZE_SETTLE_MS = 250;

/**
 * Element size from a ResizeObserver, plus whether it has held still for `ELEMENT_SIZE_SETTLE_MS`.
 * Maps use `stable` to fit their pins once the sidebar fold animation (and any first layout) ends.
 */
export function useElementSize(ref: React.RefObject<HTMLElement | null>): { width: number; height: number; stable: boolean } {
  const [h, setH] = useState(0);
  const [w, setW] = useState(0);
  const [stable, setStable] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const update = () => {
      setH(el.clientHeight);
      setW(el.clientWidth);
      setStable(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setStable(true), ELEMENT_SIZE_SETTLE_MS);
    };
    update();
    if (typeof ResizeObserver === "undefined") return () => window.clearTimeout(timer);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref]);
  return { width: w, height: h, stable };
}
