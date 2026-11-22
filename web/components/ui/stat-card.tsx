import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  /** What is measured, e.g. "Pipeline value". */
  label: string;
  /** The figure itself, already formatted (money, count). Rendered in tabular numerals. */
  value: ReactNode;
  /** A small unit set beside the figure, e.g. "CAD" or "total". */
  unit?: string;
  /** One line under the figure, e.g. "2 deals in motion". Pass two spans to put one fact at each end of the line. */
  note?: ReactNode;
  /** A status pill or interval delta aligned to the figure's right edge. */
  indicator?: ReactNode;
  /** A small icon at the top right of the card. */
  icon?: ReactNode;
  className?: string;
};

/**
 * An overview stat card (docs/DESIGN.md "Service Pact Summary Cards"): 16px padding, 1px hairline, 8px radius.
 * Presentational only; the page computes the figure.
 */
export function StatCard({ label, value, unit, note, indicator, icon, className }: StatCardProps) {
  return (
    <div data-slot="stat-card" className={cn("flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-nav">{label}</p>
        {icon && (
          <span aria-hidden="true" className="text-ink-2 [&_svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="flex items-baseline gap-1.5 text-[28px] leading-9 font-semibold tracking-tight text-ink">
          {value}
          {unit && <span className="text-xs font-medium text-ink-2">{unit}</span>}
        </p>
        {indicator}
      </div>
      {note && <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-hairline pt-2 text-xs text-ink-2">{note}</p>}
    </div>
  );
}
