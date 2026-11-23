import Link from "next/link";
import { initialsOf } from "@/lib/initials";
import type { ReactNode } from "react";

/**
 * The panel every list page puts its rows in: a rounded white panel on the Card shadow, an optional column header
 * from 768px up (decoration for sighted scanning, hidden from assistive tech because every row names its own cells),
 * and hairline-divided rows.
 */
export function ListPanel({ columns, headings, children, footer, joined = false }: { columns: string; headings: ReactNode[]; children: ReactNode; /** A line under the rows, e.g. "Showing 6 of 6 agreements". */ footer?: ReactNode; /** The panel sits right under a toolbar that is its top: no top corners or top edge of its own. */ joined?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-panel border border-hairline bg-surface shadow-card ${joined ? "rounded-t-none border-t-0" : ""}`}>
      <div
        aria-hidden="true"
        className={`hidden h-10 items-center border-b border-hairline bg-ground/70 px-5 text-[12px] font-semibold text-ink-2 md:grid md:gap-x-4 ${columns}`}
      >
        {headings.map((heading, index) => (
          <span key={index}>{heading}</span>
        ))}
      </div>
      <ul className="stagger divide-y divide-hairline">{children}</ul>
      {footer && <div className="border-t border-hairline bg-ground/70 px-5 py-3 text-[13px] text-ink-2">{footer}</div>}
    </div>
  );
}

/** Row hover and focus treatment shared by the list pages; a row is a link or holds links. */
export const ROW_CLASSES = "transition-colors duration-150 hover:bg-action-tint/50";

/** A rounded tile with a name's initials in the display face; the same Action Tint for everyone, so colour never implies rank. */
export function Initials({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-control bg-action-tint font-display font-semibold text-action ${large ? "size-11 text-[15px]" : "size-9 text-[13px]"}`}
    >
      {initialsOf(name)}
    </span>
  );
}

export type Chip = { label: string; href: string; active: boolean; /** A stage dot class, for chips that name a pipeline stage. */ dotClass?: string };

/**
 * A row of filter links that read as tabs: the active one is selected, the rest are one tap from it. A plain link per
 * chip keeps the page server-rendered and the filter in the URL.
 */
export function FilterChips({ label, chips }: { label: string; chips: Chip[] }) {
  return (
    <nav aria-label={label} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href}
          aria-current={chip.active ? "true" : undefined}
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 lg:h-9 ${
            chip.active ? "bg-action-tint text-action-press" : "text-ink-nav hover:bg-board hover:text-ink"
          }`}
        >
          {chip.dotClass && <span aria-hidden="true" className={`size-2 rounded-full ${chip.dotClass}`} />}
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}
