import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { printStyles, type CopyType, COPY_WATERMARK } from "./printShared";

type PrintableShellProps = {
  title: string;
  subtitle: string;
  showWatermark?: boolean;
  copyType?: string;
  children: ReactNode;
};

export function PrintableShell({ title, subtitle, showWatermark = false, copyType = "white", children }: PrintableShellProps) {
  const watermark = COPY_WATERMARK[(copyType as CopyType) ?? "white"] ?? COPY_WATERMARK.white;

  return (
    <div className="print-a4 mx-auto max-w-[210mm] bg-white p-6 text-black">
      <style>{printStyles()}</style>
      <div className="no-print mb-4 flex justify-end">
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>
      <div className="relative border border-black p-4">
        {showWatermark ? (
          <div className="pointer-events-none absolute right-3 top-2 text-xs font-semibold text-gray-500">{watermark}</div>
        ) : null}
        <div className="mb-3 text-center">
          <img src="/nrcs-logo-source.png" alt="NRCS logo" className="mx-auto mb-1 h-20 w-auto object-contain" />
          <div className="text-lg font-bold">{title}</div>
          <div className="text-xs">{subtitle}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
