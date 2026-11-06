import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/status-pill";
import { formatTermDate } from "@/domain/agreement/term";
import { expiringLabel, EXPIRING_WINDOW_DAYS, type ExpiringAgreement } from "@/domain/pipeline";
import { formatCad } from "@/lib/money";
import { ColumnHeader } from "./kanban-column";

const DAY_MS = 86_400_000;

/** Whole days from `today` to a `YYYY-MM-DD` end date (never negative). */
function daysLeft(termEnd: string, today: string): number {
  return Math.max(0, Math.round((Date.parse(termEnd) - Date.parse(today)) / DAY_MS));
}

/** One accepted agreement whose term ends soon: when it ends, what renewal does with it, and what it is worth. */
function ExpiringCard({ row, today, index }: { row: ExpiringAgreement; today: string; index: number }) {
  const left = daysLeft(row.termEnd, today);
  return (
    <Link
      href={`/agreements/${row.id}`}
      data-expiring
      style={{ "--i": index } as CSSProperties}
      className="settle block rounded-panel border border-hairline bg-surface p-4 text-ink shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-lift"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusPill tone="attention" label={`Ends ${formatTermDate(row.termEnd)}`} />
        <span title={`${left} days left`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger">
          <Icon name="clock" className="size-3.5" />
          {left}d
        </span>
      </div>
      <h3 className="mt-3 font-display text-[15px] leading-snug font-semibold tracking-tight">{row.site}</h3>
      <p className="text-[12px] text-ink-2">{row.customer}</p>
      <p className="text-[12px] text-ink-2">{row.number}</p>
      <p className="mt-2 text-[12px] break-words text-ink-2">{expiringLabel(row, today)}</p>
      <div className="mt-3 flex items-end justify-between gap-2 border-t border-hairline pt-3">
        <span className="text-[15px] font-semibold">{formatCad(row.annualCents)}/yr</span>
        <Icon name="chevron" className="size-4 text-ink-2" />
      </div>
    </Link>
  );
}

/**
 * Accepted agreements ending within 90 days, as a column beside Refused with the same header and card structure as the
 * stages (renewal S6). Its title links to the full list.
 */
export function ExpiringColumn({ rows, today, className = "" }: { rows: ExpiringAgreement[]; today: string; className?: string }) {
  const total = rows.reduce((sum, row) => sum + row.annualCents, 0);
  return (
    <section data-column="expiring" id="panel-expiring" aria-labelledby="column-expiring" className={`flex-col gap-2.5 rounded-panel bg-board/60 p-3 ${className}`}>
      <ColumnHeader
        id="column-expiring"
        title={
          <Link href="/pipeline?view=expiring" className="relative hover:underline after:absolute after:-inset-x-2 after:-inset-y-3">
            Expiring soon
          </Link>
        }
        dotClass="bg-attention-fg"
        count={rows.length}
        total={`${formatCad(total)}/yr`}
        note={`ends in ${EXPIRING_WINDOW_DAYS} days`}
      />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-1 py-5 text-center text-ink-2">
          <Icon name="calendar" className="size-9 opacity-70" />
          <p className="text-[12px]">Nothing ends in the next {EXPIRING_WINDOW_DAYS} days</p>
        </div>
      ) : (
        rows.map((row, index) => <ExpiringCard key={row.id} row={row} today={today} index={index} />)
      )}
    </section>
  );
}
