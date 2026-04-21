import QRCode from "react-qr-code";

type LabelSize = "50x50" | "100x50";

type QRLabelProps = {
  title: string;
  subtitle: string;
  value: string;
  size?: LabelSize;
  className?: string;
};

export function QRLabel({ title, subtitle, value, size = "100x50", className }: QRLabelProps) {
  const width = size === "50x50" ? "50mm" : "100mm";
  const height = "50mm";

  return (
    <div
      className={className}
      style={{
        width,
        height,
        border: "1px solid #d1d5db",
        borderRadius: "6px",
        padding: "6px",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "8px",
        alignItems: "center",
        background: "white",
        color: "#111827",
      }}
    >
      <div style={{ width: size === "50x50" ? 88 : 128, height: size === "50x50" ? 88 : 128 }}>
        <QRCode value={value} size={size === "50x50" ? 88 : 128} />
      </div>
      <div style={{ minWidth: 0 }}>
        <img src="/nrcs-logo.png" alt="NRCS" style={{ width: 28, height: 28, marginBottom: 6 }} />
        <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 11, lineHeight: 1.2, marginTop: 4, wordBreak: "break-word" }}>{subtitle}</div>
      </div>
    </div>
  );
}
