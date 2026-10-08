/**
 * Mobile bottom sheet with snap points (peek, half, full). The handle is a button that cycles
 * snaps, and it can be dragged. Used for the facility list and the facility details on phones.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./parts";

export type SheetSnap = "peek" | "half" | "full";

export function snapHeight(snap: SheetSnap, frameHeight: number, half = 400, peek = 96): number {
  const full = Math.max(peek, frameHeight - 8);
  if (snap === "full") return full;
  if (snap === "half") return Math.min(half, full);
  return Math.min(peek, full);
}

export function BottomSheet({
  snap,
  onSnap,
  frameHeight,
  half = 400,
  label,
  children,
  className,
  testId,
}: {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  frameHeight: number;
  half?: number;
  label: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const base = snapHeight(snap, frameHeight, half);
  const height = drag ?? base;

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    start.current = { y: e.clientY, h: base, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    const dy = s.y - e.clientY;
    if (Math.abs(dy) > 4) s.moved = true;
    if (s.moved) setDrag(Math.max(snapHeight("peek", frameHeight), Math.min(snapHeight("full", frameHeight), s.h + dy)));
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (!s.moved) {
      onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek");
      setDrag(null);
      return;
    }
    const h = drag ?? base;
    const options: SheetSnap[] = ["peek", "half", "full"];
    let best: SheetSnap = snap;
    let bestDist = Infinity;
    for (const o of options) {
      const d = Math.abs(snapHeight(o, frameHeight, half) - h);
      if (d < bestDist) {
        best = o;
        bestDist = d;
      }
    }
    setDrag(null);
    onSnap(best);
  };

  return (
    <div
      data-testid={testId}
      data-snap={snap}
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[18px] border-t border-[#E5E7EB] bg-white text-[#111827] shadow-[0_-8px_24px_rgba(15,23,42,.12)] dark:border-[#26364A] dark:bg-[#162130] dark:text-[#E6EAF0]",
        drag == null && "transition-[height] duration-200 ease-out motion-reduce:transition-none",
        className
      )}
      style={{ height }}
    >
      <button
        type="button"
        aria-label={`${label}: ${snap === "full" ? "collapse" : "expand"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        className={cn("flex h-6 w-full shrink-0 touch-none items-center justify-center", focusRing)}
      >
        <span className="h-1 w-10 rounded-full bg-[#C9CED6] dark:bg-[#3A4B62]" />
      </button>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
