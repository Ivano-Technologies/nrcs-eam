import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import * as React from "react";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The readback under a date field: the picked day in the table date format ("14 Jan 2027"), whatever the
 * browser locale. Empty when the field is empty or holds anything but a valid YYYY-MM-DD day.
 */
export function formatDateReadback(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!ISO_DAY.test(v)) return "";
  const text = formatDate(v);
  return text === v ? "" : text;
}

type DateInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** Classes for the wrapper that holds the input and its readback. */
  wrapperClassName?: string;
};

/**
 * Native date picker with a small muted readback line under it (Coco, #151). The picker shows the browser's
 * own format, so the readback spells the chosen day out in the same format as the tables. Nothing shows
 * when the field is empty. Use this for every date field instead of Input type="date".
 */
export function DateInput({ wrapperClassName, value, id, "aria-describedby": describedBy, ...props }: DateInputProps) {
  const autoId = React.useId();
  const readbackId = `${id ?? autoId}-readback`;
  const text = formatDateReadback(value);
  const described = [describedBy, text ? readbackId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1", wrapperClassName)} data-slot="date-input">
      <Input type="date" id={id} value={value} aria-describedby={described} {...props} />
      {text ? (
        <p id={readbackId} data-testid="date-readback" className="text-xs text-muted-foreground">
          {text}
        </p>
      ) : null}
    </div>
  );
}
