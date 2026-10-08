import { forwardRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Boxes,
  Check,
  Copy,
  Loader2,
  MapPin,
  MoreHorizontal,
  X,
} from "lucide-react";
import {
  ASSET_STATUS_COLOURS,
  READINESS_COLOURS,
  READINESS_LABELS,
  READINESS_PILLS,
  pinTier,
  type MapScheme,
} from "@/lib/facilityMapHelpers";
import {
  TYPE_LABELS,
  facilityPosition,
  formatCount,
  formatMapDate,
  formatNaira,
  type MapFacility,
  type MapFacilityDetail,
} from "@/lib/assetMap/model";
import { appPath } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { focusRing, mutedText, TypeGlyph } from "./parts";

function locationLine(f: MapFacility): string | null {
  const state = f.state?.trim();
  let stateText: string | null = null;
  if (state) {
    if (/^(fct|federal capital territory)$/i.test(state)) stateText = "FCT";
    else stateText = /state$/i.test(state) ? state : `${state} State`;
  }
  return [f.city?.trim() || null, stateText].filter(Boolean).join(", ") || null;
}

function Gauge({ percent, tier, scheme }: { percent: number; tier: keyof typeof READINESS_COLOURS.light; scheme: MapScheme }) {
  const r = 46;
  const cx = 56;
  const cy = 56;
  const p = Math.max(0, Math.min(100, percent)) / 100;
  const angle = Math.PI * (1 - p);
  const x1 = cx + r * Math.cos(angle);
  const y1 = cy - r * Math.sin(angle);
  const colour = READINESS_COLOURS[scheme][tier];
  const pill = READINESS_PILLS[tier];
  return (
    <svg width="112" height="68" viewBox="0 0 112 68" role="img" aria-label={`Stock readiness ${percent}%, ${READINESS_LABELS[tier]}`}>
      <path d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" strokeWidth={10} strokeLinecap="round" className="stroke-[#E9ECF0] dark:stroke-[#24344A]" />
      {p > 0 ? (
        <path d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`} fill="none" stroke={colour} strokeWidth={10} strokeLinecap="round" />
      ) : null}
      <text x="56" y="50" textAnchor="middle" className="fill-current tabular-nums" style={{ font: "700 22px Inter, system-ui, sans-serif" }}>
        {percent}%
      </text>
      <text x="56" y="66" textAnchor="middle" style={{ font: "600 11px Inter, system-ui, sans-serif", fill: scheme === "dark" ? pill.darkFg : pill.lightFg }}>
        {READINESS_LABELS[tier]}
      </text>
    </svg>
  );
}

function StatTile({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#E5E7EB] p-3 dark:border-[#26364A]">
      <p className={cn("text-xs", mutedText)}>{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {children}
    </div>
  );
}

export type FacilityDrawerProps = {
  facility: MapFacility;
  detail: MapFacilityDetail | undefined;
  detailLoading: boolean;
  scheme: MapScheme;
  onClose: () => void;
  onSelectFacility: (id: number) => void;
  variant?: "drawer" | "sheet";
  className?: string;
};

export const FacilityDrawer = forwardRef<HTMLDivElement, FacilityDrawerProps>(function FacilityDrawer(
  { facility: f, detail, detailLoading, scheme, onClose, onSelectFacility, variant = "drawer", className },
  ref
) {
  const tier = pinTier(f);
  const titleId = `asset-map-drawer-title-${f.id}`;
  const location = locationLine(f);
  const position = facilityPosition(f);
  const [copied, setCopied] = useState(false);
  const statusColours = ASSET_STATUS_COLOURS[scheme];
  const statsVisible = f.statsVisible && (detail ? detail.statsVisible : true);
  const lastMovement = formatMapDate(f.lastMovementDate);
  const coords = position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : null;

  const copyCoords = async () => {
    if (!coords) return;
    try {
      await navigator.clipboard.writeText(coords);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid="asset-map-drawer"
      data-variant={variant}
      className={cn("flex min-h-0 flex-col outline-none", className)}
    >
      {/* Header */}
      <div className="border-b border-[#E5E7EB] p-4 dark:border-[#26364A]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#F3F4F6] px-2 dark:bg-[#1E2B3C]">
              <TypeGlyph type={f.facilityType} scheme={scheme} neutral="chip" size={12} />
              {TYPE_LABELS[f.facilityType]}
            </span>
            {f.code ? <span className={cn("tabular-nums", mutedText)}>{f.code}</span> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close facility details"
            className={cn("-mr-1 -mt-1 grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]", focusRing)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id={titleId} className="mt-2 text-[19px] font-semibold leading-[26px]">
          {f.name}
        </h2>
        {location ? (
          <p className={cn("mt-1 flex items-center gap-1.5 text-[13px]", mutedText)}>
            <MapPin className="h-3.5 w-3.5" />
            {location}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-medium">
          {f.isActive ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#F3F4F6] px-2 dark:bg-[#1E2B3C]">
              <span className="h-2 w-2 rounded-full bg-[#15803D] dark:bg-[#22A35A]" />
              Active
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded-full border border-dashed border-[#8A8F98] px-2 dark:border-[#64768E]">
              Offline
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        {/* Stock readiness */}
        <section aria-label="Stock readiness" className="flex items-center gap-4 border-b border-[#E5E7EB] pb-4 dark:border-[#26364A]">
          {tier !== "none" && tier !== "offline" && f.stockScorePercent != null ? (
            <>
              <Gauge percent={f.stockScorePercent} tier={tier} scheme={scheme} />
              <div className="text-[13px]">
                <h3 className="text-sm font-semibold">Stock readiness</h3>
                <p className={cn("mt-1", mutedText)}>
                  {formatCount(f.adequateCards)} of {formatCount(f.totalCards)} stock cards adequate
                </p>
                {lastMovement ? <p className={mutedText}>Last stock movement {lastMovement}</p> : null}
              </div>
            </>
          ) : (
            <div className="text-[13px]">
              <h3 className="text-sm font-semibold">Stock readiness</h3>
              <p className={cn("mt-1", mutedText)}>
                {f.isActive ? "No stock cards with a minimum level yet." : "This facility is offline."}
              </p>
              {f.isActive ? (
                <Link
                  href={appPath("/inventory/stock-overview")}
                  className={cn("mt-1 inline-block font-medium text-[#1E3A8A] hover:underline dark:text-[#93C5FD]", focusRing)}
                >
                  Stock settings
                </Link>
              ) : null}
            </div>
          )}
        </section>

        {/* At a glance */}
        <section aria-labelledby={`${titleId}-glance`}>
          <h3 id={`${titleId}-glance`} className="mb-2 text-[13px] font-semibold">
            At a glance
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {statsVisible && f.assetCount != null ? (
              <StatTile label="Assets" value={formatCount(f.assetCount)}>
                {f.assetsByStatus && f.assetCount > 0 ? (
                  <>
                    <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-[#E9ECF0] dark:bg-[#24344A]" aria-hidden="true">
                      {(["inUse", "maintenance", "retired"] as const).map((k) => (
                        <span key={k} style={{ width: `${(f.assetsByStatus![k] / f.assetCount!) * 100}%`, background: statusColours[k] }} />
                      ))}
                    </span>
                    <p className={cn("mt-1.5 text-xs", mutedText)}>
                      {f.assetsByStatus.inUse} in use · {f.assetsByStatus.maintenance} in maintenance · {f.assetsByStatus.retired} retired
                    </p>
                  </>
                ) : null}
              </StatTile>
            ) : null}
            {statsVisible ? (
              <StatTile
                label="Book value"
                value={detail?.bookValue != null ? formatNaira(detail.bookValue) : detailLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" /> : "Not available"}
              >
                <p className={cn("mt-1 text-xs", mutedText)}>Operational assets</p>
              </StatTile>
            ) : null}
            <StatTile label="Inventory items" value={formatCount(f.inventoryCount)}>
              <p className={cn("mt-1 text-xs", mutedText)}>Recorded at this facility</p>
            </StatTile>
            {statsVisible ? (
              <StatTile
                label="Open work orders"
                value={detail?.openWorkOrders != null ? formatCount(detail.openWorkOrders) : detailLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" /> : "Not available"}
              >
                {detail?.overdueWorkOrders != null ? (
                  <p className={cn("mt-1 text-xs", mutedText)}>{detail.overdueWorkOrders} overdue</p>
                ) : null}
              </StatTile>
            ) : null}
          </div>
          {!statsVisible ? (
            <p className={cn("mt-2 rounded-[10px] bg-[#F3F4F6] p-3 text-xs dark:bg-[#1E2B3C]", mutedText)} data-testid="asset-map-drawer-stats-hidden">
              Asset counts, book value and work orders are shown for your own facility only.
            </p>
          ) : null}
        </section>

        {/* Contact and location */}
        <section aria-labelledby={`${titleId}-contact`} className="text-[13px]">
          <h3 id={`${titleId}-contact`} className="mb-2 text-[13px] font-semibold">
            Contact and location
          </h3>
          <dl className="divide-y divide-[#E5E7EB] dark:divide-[#26364A]">
            <div className="flex justify-between gap-3 py-2">
              <dt className={mutedText}>Contact</dt>
              <dd className="text-right font-medium">{detail?.contactPerson || (detailLoading ? "" : "Not recorded")}</dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt className={mutedText}>Phone</dt>
              <dd className="text-right font-medium">
                {detail?.contactPhone ? (
                  <a href={`tel:${detail.contactPhone.replace(/[^\d+]/g, "")}`} className={cn("text-[#1E3A8A] hover:underline dark:text-[#93C5FD]", focusRing)}>
                    {detail.contactPhone}
                  </a>
                ) : detailLoading ? (
                  ""
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
            {detail?.parentFacility ? (
              <div className="flex justify-between gap-3 py-2">
                <dt className={mutedText}>Reports to</dt>
                <dd className="text-right font-medium">
                  <button
                    type="button"
                    onClick={() => onSelectFacility(detail.parentFacility!.id)}
                    className={cn("text-right text-[#1E3A8A] hover:underline dark:text-[#93C5FD]", focusRing)}
                  >
                    {detail.parentFacility.name}
                  </button>
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className={mutedText}>Coordinates</dt>
              <dd className="flex items-center gap-1.5 text-right font-medium tabular-nums">
                {coords ? (
                  <>
                    {coords}
                    <button
                      type="button"
                      onClick={copyCoords}
                      aria-label={copied ? "Coordinates copied" : "Copy coordinates"}
                      className={cn("grid h-7 w-7 place-items-center rounded-md hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]", focusRing)}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </>
                ) : (
                  <Link
                    href={appPath(`/facilities/${f.id}`)}
                    data-testid="asset-map-add-location"
                    className={cn("text-[#1E3A8A] hover:underline dark:text-[#93C5FD]", focusRing)}
                  >
                    No location yet. Add it
                  </Link>
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Sticky footer */}
      <div className="flex items-center gap-2 border-t border-[#E5E7EB] p-3 dark:border-[#26364A]">
        <Button asChild className="h-10 flex-1">
          <Link href={appPath(`/facilities/${f.id}`)}>
            Open facility
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-10 flex-1">
          <Link href={`${appPath("/assets")}?siteId=${f.id}`}>
            <Boxes className="mr-1.5 h-4 w-4" />
            View assets
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 w-10 px-0" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={appPath("/inventory/tracking/stock-cards")}>Stock cards</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={appPath("/work-orders")}>Work orders</Link>
            </DropdownMenuItem>
            {position ? (
              <DropdownMenuItem asChild>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Directions in Google Maps
                </a>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
