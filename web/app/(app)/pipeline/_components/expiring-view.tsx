import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { formatTermDate } from "@/domain/agreement/term";
import { expiringLabel, EXPIRING_WINDOW_DAYS, type ExpiringAgreement } from "@/domain/pipeline";
import { formatCad } from "@/lib/money";

const link = "inline-flex min-h-11 items-center font-medium text-action lg:min-h-0";

/** "Expiring soon": accepted agreements ending in the next 90 days and what renewal does with each (renewal S6). */
export function ExpiringView({ rows, today }: { rows: ExpiringAgreement[]; today: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-[13px]">
        <Link href="/pipeline" className={link}>
          Back to the board
        </Link>
      </div>
      <PageHeader title="Expiring soon" />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-panel border border-hairline bg-surface px-4 py-12 text-center">
          <p className="text-[14px] font-semibold">No agreements end in the next {EXPIRING_WINDOW_DAYS} days.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface">
          {rows.map((row) => (
            <li key={row.id} data-expiring className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-col">
                <Link href={`/agreements/${row.id}`} className="text-[13.5px] font-semibold text-ink hover:text-action">
                  {row.site}
                </Link>
                <p className="text-[12px] text-ink-2">
                  {row.customer} · {row.number}
                </p>
                <p className="text-[12px] break-words text-ink-2">{expiringLabel(row, today)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-x-3 text-[12px] text-ink-2 sm:flex-col sm:items-end">
                <span>Ends {formatTermDate(row.termEnd)}</span>
                <span className="font-semibold text-ink">{formatCad(row.annualCents)}/yr</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
