import { useId, useMemo, useRef } from "react";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRLabel } from "@/components/QRLabel";

type CardQrCodeProps = {
  idValue: string;
  title: string;
  subtitle: string;
  encodedValue: string;
  labelSize?: "50x50" | "100x50";
};

export function CardQrCode({
  idValue,
  title,
  subtitle,
  encodedValue,
  labelSize = "100x50",
}: CardQrCodeProps) {
  const printId = useId().replace(/:/g, "-");
  const svgWrapRef = useRef<HTMLDivElement | null>(null);
  const encodedText = useMemo(() => encodedValue, [encodedValue]);

  const downloadPng = async () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = png;
      a.download = `${idValue}.png`;
      a.click();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const printLabel = () => {
    const el = document.getElementById(printId);
    if (!el) return;
    const win = window.open("", "_blank", "width=480,height=360");
    if (!win) return;
    win.document.write(`
      <html>
      <head>
        <title>QR Label</title>
        <style>
          body { margin: 0; padding: 10px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
          @media print { body { margin: 0; padding: 0; } }
        </style>
      </head>
      <body>${el.outerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid={`card-qr-${idValue}`}
          className="rounded border bg-background/95 p-1 shadow-sm hover:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <QRCode value={encodedValue} size={64} />
        </button>
      </DialogTrigger>
      <DialogContent
        data-testid={`qr-modal-${idValue}`}
        className="max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div ref={svgWrapRef} className="mx-auto w-fit rounded border bg-white p-3">
            <QRCode value={encodedValue} size={256} />
          </div>
          <div className="rounded border bg-muted/50 p-2 text-xs break-all">{encodedText}</div>
          <div className="flex gap-2">
            <Button data-testid="qr-print-btn" onClick={printLabel}>
              Print Label
            </Button>
            <Button variant="outline" onClick={downloadPng}>
              Download PNG
            </Button>
          </div>
          <div id={printId} className="w-fit">
            <QRLabel title={title} subtitle={subtitle} value={encodedValue} size={labelSize} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
