import Link from "next/link";
import { CalendarClockIcon } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { SectionPanel } from "@/components/ui/section-panel";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatTermDate } from "@/domain/agreement/term";
import { expiringLabel, EXPIRING_WINDOW_DAYS, type ExpiringAgreement } from "@/domain/pipeline";
import { formatCad } from "@/lib/money";

const DAY_MS = 86_400_000;
const daysLeft = (termEnd: string, today: string) => Math.max(0, Math.round((Date.parse(termEnd) - Date.parse(today)) / DAY_MS));

const TH = "h-10 px-4 text-left text-[12px] font-semibold text-ink-2";
const TD = "px-4 py-3 align-top";

/** "Expiring soon": accepted agreements ending in the next 90 days and what renewal does with each (renewal S6). */
export function ExpiringView({ rows, today }: { rows: ExpiringAgreement[]; today: string }) {
  const atStake = rows.reduce((sum, row) => sum + row.annualCents, 0);
  const soonest = rows[0];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expiring soon"
        subtitle={`Accepted agreements ending in the next ${EXPIRING_WINDOW_DAYS} days, soonest first.`}
        action={<LinkButton href="/pipeline">Back to the board</LinkButton>}
      />

      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <StatCard label="Ending soon" icon={<CalendarClockIcon />} value={String(rows.length)} unit={rows.length === 1 ? "agreement" : "agreements"} note={`Within ${EXPIRING_WINDOW_DAYS} days`} />
        <StatCard label="At stake" value={formatCad(atStake)} unit="CAD" note="a year, before renewal" />
        <StatCard label="Soonest end" value={soonest ? formatTermDate(soonest.termEnd) : "None"} note={soonest ? `${daysLeft(soonest.termEnd, today)} days left` : `Nothing ends in ${EXPIRING_WINDOW_DAYS} days`} />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-panel border border-hairline bg-surface px-4 py-12 text-center shadow-card">
          <p className="text-[14px] font-semibold">No agreements end in the next {EXPIRING_WINDOW_DAYS} days.</p>
        </div>
      ) : (
        <SectionPanel id="expiring-list" title="Ending soon" note="Soonest first" flush>
          <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="border-b border-hairline bg-ground/70">
                <tr>
                  {["Agreement", "Customer", "Ends", "Per year", "Renewal"].map((heading) => (
                    <th key={heading} scope="col" className={TH}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((row) => (
                  <tr key={row.id} data-expiring className="hover:bg-ground/70">
                    <td className={TD}>
                      <Link href={`/agreements/${row.id}`} className="font-semibold text-ink hover:text-action">
                        {row.site}
                      </Link>
                      <p className="text-[12px] text-ink-2">{row.number}</p>
                    </td>
                    <td className={TD}>{row.customer}</td>
                    <td className={TD}>
                      <span className="flex flex-wrap items-center gap-2">
                        {formatTermDate(row.termEnd)}
                        <StatusPill tone="attention" label={`${daysLeft(row.termEnd, today)} days`} />
                      </span>
                    </td>
                    <td className={`${TD} font-semibold`}>{formatCad(row.annualCents)}/yr</td>
                    <td className={`${TD} break-words text-ink-nav`}>{expiringLabel(row, today)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y divide-hairline md:hidden">
            {rows.map((row) => (
              <li key={row.id} data-card-expiring className="flex flex-col gap-1 px-4 py-3">
                <Link href={`/agreements/${row.id}`} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-ink hover:text-action">
                  {row.site}
                </Link>
                <p className="text-[12px] text-ink-2">
                  {row.customer} · {row.number}
                </p>
                <p className="text-[12px] break-words text-ink-2">{expiringLabel(row, today)}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-[12px] text-ink-2">
                  <span>Ends {formatTermDate(row.termEnd)}</span>
                  <span className="font-semibold text-ink">{formatCad(row.annualCents)}/yr</span>
                </p>
              </li>
            ))}
          </ul>
        </SectionPanel>
      )}
    </div>
  );
}
