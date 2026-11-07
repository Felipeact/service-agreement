/**
 * The product's authored drawings: one line weight, currentColor for the drawing and Action Blue for the one thing
 * that matters in each. They fill empty and quiet moments; they are decoration only (aria-hidden) and say nothing
 * the text beside them does not.
 */

import type { ReactNode } from "react";

export type SpotKind = "clipboard" | "envelope" | "signature" | "sheet" | "people" | "pin";

const SPOT_SHAPES: Partial<Record<SpotKind, ReactNode>> = {
  /** An agreement being drafted. */
  clipboard: (
    <>
      <rect x="15" y="11" width="34" height="45" rx="5" className="fill-surface" />
      <rect x="24" y="6" width="16" height="10" rx="3.5" className="fill-action-tint stroke-action" />
      <path d="M23 28h18M23 36h18M23 44h10" />
    </>
  ),
  /** Out with the customer. */
  envelope: (
    <>
      <rect x="8" y="17" width="48" height="33" rx="5" className="fill-surface" />
      <path d="m10 21 22 16 22-16" className="stroke-action" />
    </>
  ),
  /** Waiting on a signature. */
  signature: (
    <>
      <rect x="13" y="8" width="34" height="46" rx="4" className="fill-surface" />
      <path d="M20 20h20M20 27h14" />
      <path d="M20 43c3-8 6-8 8 0s5 3 8-3" className="stroke-action" />
      <path d="m44 46 11-15" className="stroke-action" strokeWidth="2.4" />
    </>
  ),
};

SPOT_SHAPES.sheet = (
  /** An equipment list being sent: a spreadsheet with an arrow rising from it. */
  <>
    <rect x="10" y="8" width="36" height="46" rx="4" className="fill-surface" />
    <path d="M10 22h36M10 34h22M24 8v46" />
    <circle cx="47" cy="45" r="11" className="fill-action-tint stroke-action" />
    <path d="M47 51V40m-5 5 5-5 5 5" className="stroke-action" />
  </>
);

SPOT_SHAPES.people = (
  /** Customers: two people. */
  <>
    <circle cx="25" cy="22" r="8" className="fill-surface" />
    <path d="M9 52c0-9 7-15 16-15s16 6 16 15" className="fill-surface" />
    <circle cx="44" cy="24" r="6.5" className="fill-action-tint stroke-action" />
    <path d="M45 38c6 1 10 6 10 13" className="stroke-action" />
  </>
);

SPOT_SHAPES.pin = (
  /** Sites: a map pin over a roofline. */
  <>
    <path d="M32 6c-9 0-15 6-15 14 0 10 15 24 15 24s15-14 15-24c0-8-6-14-15-14Z" className="fill-surface" />
    <circle cx="32" cy="20" r="5.5" className="fill-action-tint stroke-action" />
    <path d="M10 56h44M18 56V48l8-5M46 56V48l-8-5" />
  </>
);

/** A 64px spot drawing for an empty column or list. Set its colour with a text class on a parent. */
export function Spot({ kind, className = "size-16" }: { kind: SpotKind; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SPOT_SHAPES[kind]}
    </svg>
  );
}

/**
 * A rooftop air-handling unit under the two seasons it is serviced in: sun and snowflake joined by a dotted arc,
 * the visit cycle of a preventive-maintenance agreement. Drawn for the Night shell: the lines are Night Ink and the
 * control light and airflow are Action Blue. Set the line colour with a text class.
 */
export function RooftopScene({
  className = "",
  accentClass = "stroke-action",
  accentFillClass = "fill-action",
}: {
  className?: string;
  /** The stroke colour of the visit arc and the airflow; on the dark sign-in panel a light accent, on a light panel the brand green. */
  accentClass?: string;
  /** The fill of the unit's control light. */
  accentFillClass?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 220"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* the visit cycle: a sun, a snowflake and the arc between them */}
      <path d="M72 46Q160-6 248 46" strokeDasharray="2 7" className={accentClass} strokeWidth="2" />
      <circle cx="52" cy="58" r="8" />
      <path d="M52 40v6M52 70v6M34 58h6M64 58h6M39.3 45.3l4.2 4.2M60.5 66.5l4.2 4.2M39.3 70.7l4.2-4.2M60.5 49.5l4.2-4.2" />
      <path d="M268 48v20M259.3 53l17.4 10M259.3 63l17.4-10" />
      <path d="m264 44 4 4 4-4M264 72l4-4 4 4M255 57l5 1-1 5M281 59l-5-1 1-5" strokeWidth="1.2" />

      {/* airflow rising off the unit */}
      <path d="M142 84c-7-9 7-14 0-24s7-14 0-24" className={accentClass} opacity="0.9" />
      <path d="M160 82c-7-9 7-14 0-24s7-14 0-24" className={accentClass} opacity="0.6" />
      <path d="M178 84c-7-9 7-14 0-24s7-14 0-24" className={accentClass} opacity="0.9" />

      {/* the unit: fan deck, cabinet, louvres, control panel */}
      <rect x="110" y="86" width="100" height="10" rx="3" className="fill-surface/5" />
      <path d="M126 86a34 8 0 0 1 68 0" />
      <rect x="82" y="96" width="156" height="66" rx="6" className="fill-surface/5" />
      <path d="M98 112h62M98 122h62M98 132h62M98 142h62" />
      <rect x="176" y="108" width="46" height="38" rx="4" />
      <circle cx="191" cy="122" r="5" />
      <path d="M191 119v3l2 1.5" strokeWidth="1.2" />
      <circle cx="208" cy="119" r="2.4" className={`${accentFillClass} ${accentClass}`} />
      <circle cx="208" cy="130" r="2.4" />
      <path d="M184 138h30" />

      {/* curb and roof line */}
      <rect x="70" y="162" width="180" height="16" rx="3" />
      <path d="M24 178h272" opacity="0.45" />
      <path d="M92 178l-6 12M228 178l6 12M24 190h272" opacity="0.2" />
    </svg>
  );
}
