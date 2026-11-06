import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The panel every list page puts its rows in: a rounded white panel on the Card shadow, an optional column header
 * from 768px up (decoration for sighted scanning, hidden from assistive tech because every row names its own cells),
 * and hairline-divided rows.
 */
export function ListPanel({ columns, headings, children }: { columns: string; headings: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-panel border border-hairline bg-surface shadow-card">
      <div
        aria-hidden="true"
        className={`hidden border-b border-hairline bg-ground px-4 py-2.5 text-[11px] font-semibold text-ink-2 md:grid md:gap-x-4 ${columns}`}
      >
        {headings.map((heading, index) => (
          <span key={index}>{heading}</span>
        ))}
      </div>
      <ul className="divide-y divide-hairline">{children}</ul>
    </div>
  );
}

/** Row hover and focus treatment shared by the list pages; a row is a link or holds links. */
export const ROW_CLASSES = "transition-colors duration-150 hover:bg-action-tint/50";

/** The first letters of a name's first two words, for the tile that stands in for a logo on a customer row. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

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
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 lg:h-[34px] ${
            chip.active ? "border-action bg-action-tint text-action" : "border-hairline bg-surface text-ink hover:bg-ground"
          }`}
        >
          {chip.dotClass && <span aria-hidden="true" className={`size-2 rounded-full ${chip.dotClass}`} />}
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}
