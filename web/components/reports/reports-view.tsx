import Link from "next/link";
import type { ReactNode } from "react";
import type { ReportResult } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { TextInput } from "@/components/ui/text-input";
import {
  dropOff,
  signLabel,
  winRate,
  type Aging,
  type CustomerRevenue,
  type FunnelRow,
  type Headline,
  type LossRow,
  type RenewalRow,
  type ReportKey,
  type ReportRange,
  type TypeRevenue,
} from "@/domain/reports";
import { formatCad, formatCadExact } from "@/lib/money";

/** A section the member's role does not see is `null`; one the database could not read is a failed result. */
type Part<T> = ReportResult<T> | null;

export type ReportsViewProps = {
  range: ReportRange;
  notice: string | null;
  /** The org has no agreements at all, so there is nothing to report on yet (AC 16). */
  empty: boolean;
  headline: Part<Headline>;
  funnel: Part<FunnelRow[]>;
  aging: Part<Aging>;
  losses: Part<LossRow[]>;
  renewals: Part<RenewalRow[]>;
  revenueByCustomer: Part<CustomerRevenue[]>;
  revenueByType: Part<TypeRevenue[]>;
};

const STAGE_LABEL = { created: "Created", sent: "Sent", accepted: "Accepted", signed: "Signed" } as const;
const OUTCOME_LABEL = { refused: "Refused", expired: "Expired", withdrawn: "Withdrawn" } as const;

function Section({ id, title, note, download, range, children }: { id: string; title: string; note?: string; download?: ReportKey; range: ReportRange; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="mr-auto min-w-0">
          <h2 id={id} className="font-display text-[16px] font-semibold tracking-tight">
            {title}
          </h2>
          {note && <p className="text-[12px] text-ink-2">{note}</p>}
        </div>
        {download && (
          <LinkButton href={`/reports/export?report=${download}&from=${range.from}&to=${range.to}`} prefetch={false} variant="secondary" download>
            Download CSV
          </LinkButton>
        )}
      </div>
      {children}
    </section>
  );
}

function Failed({ what }: { what: string }) {
  return (
    <p role="alert" className="rounded-control bg-ground px-3 py-2.5 text-[13px] text-ink-2">
      {what} could not be read right now. The other reports are unaffected; reload to try again.
    </p>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-control bg-ground px-3 py-2.5 text-[13px] text-ink-2">{children}</p>;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-control bg-ground px-3 py-2.5">
      <dt className="text-[12px] font-medium text-ink-2">{label}</dt>
      <dd className="font-display text-[22px] leading-tight font-semibold tracking-tight break-words">{value}</dd>
      {note && <dd className="text-[12px] text-ink-2">{note}</dd>}
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-hairline">{children}</ul>;
}

function Row({ children }: { children: ReactNode }) {
  return <li className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5 text-[13px]">{children}</li>;
}

const AgreementLink = ({ id, number }: { id: string; number: string }) => (
  <Link href={`/agreements/${id}`} className="inline-flex min-h-11 items-center font-semibold text-action underline-offset-2 hover:underline lg:min-h-0">
    {number || "Agreement"}
  </Link>
);

function HeadlineSection({ part, range }: { part: Part<Headline>; range: ReportRange }) {
  if (!part) return null;
  return (
    <Section id="rep-headline" title="Headline" note={`Decisions and signatures from ${range.from} to ${range.to}; revenue and pipeline as of today.`} range={range}>
      {!part.ok ? (
        <Failed what="The headline" />
      ) : (
        <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Recurring revenue" value={formatCad(part.value.recurringCents)} note="a year, agreements in term" />
          <Stat label="Pipeline value" value={formatCad(part.value.pipelineCents)} note="a year, sent or awaiting a start" />
          <Stat label="Win rate" value={winRate({ accepted: part.value.accepted, refused: part.value.refused, expired: part.value.expired })} note={`${part.value.accepted} accepted, ${part.value.refused} refused, ${part.value.expired} expired`} />
          <Stat label="Average days to sign" value={signLabel(part.value.avgDaysToSign)} note={`${part.value.signed} signed`} />
        </dl>
      )}
    </Section>
  );
}

function FunnelSection({ part, range, money }: { part: Part<FunnelRow[]>; range: ReportRange; money: boolean }) {
  if (!part) return null;
  const rows = part.ok ? part.value : [];
  const drops = dropOff(rows.map((r) => r.n));
  const top = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Section id="rep-funnel" title="Funnel" note="Each stage counts the agreements whose own event fell in the range." download="funnel" range={range}>
      {!part.ok ? (
        <Failed what="The funnel" />
      ) : (
        <Rows>
          {rows.map((r, i) => (
            <Row key={r.stage}>
              <span className="w-24 font-semibold">{STAGE_LABEL[r.stage]}</span>
              <span aria-hidden="true" className="order-last h-2 basis-full overflow-hidden rounded-full bg-ground">
                <span className="block h-full rounded-full bg-action" style={{ width: `${(r.n / top) * 100}%` }} />
              </span>
              <span>{r.n} {r.n === 1 ? "agreement" : "agreements"}</span>
              {money && r.valueCents !== null && <span className="text-ink-2">{formatCad(r.valueCents)} a year</span>}
              {i > 0 && <span className="text-ink-2">{r.n === 0 && rows[i - 1].n === 0 ? "No agreements at this stage" : `${drops[i]}% dropped off`}</span>}
            </Row>
          ))}
        </Rows>
      )}
    </Section>
  );
}

function AgingSection({ part, range }: { part: Part<Aging>; range: ReportRange }) {
  if (!part) return null;
  return (
    <Section id="rep-aging" title="Speed and stuck deals" note="Median days between stages, and the ten oldest open agreements." download="aging" range={range}>
      {!part.ok ? (
        <Failed what="Speed and stuck deals" />
      ) : (
        <>
          <Rows>
            {part.value.medians.map((m) => (
              <Row key={m.stage}>
                <span className="w-44 font-semibold">{m.stage}</span>
                <span>{m.days === null ? "No data in this range" : `${m.days.toFixed(1)} days (median)`}</span>
              </Row>
            ))}
          </Rows>
          {part.value.stuck.length === 0 ? (
            <Empty>Nothing is waiting. Every agreement has been decided or signed.</Empty>
          ) : (
            <Rows>
              {part.value.stuck.map((s) => (
                <Row key={s.agreementId}>
                  <AgreementLink id={s.agreementId} number={s.number} />
                  <span>{s.customer}, {s.site}</span>
                  <span className="text-ink-2">{s.status.replaceAll("_", " ")} for {s.ageDays} {s.ageDays === 1 ? "day" : "days"}</span>
                </Row>
              ))}
            </Rows>
          )}
        </>
      )}
    </Section>
  );
}

function LossesSection({ part, range, money }: { part: Part<LossRow[]>; range: ReportRange; money: boolean }) {
  if (!part) return null;
  const counts = part.ok ? (["refused", "expired", "withdrawn"] as const).map((o) => `${part.value.filter((r) => r.outcome === o).length} ${OUTCOME_LABEL[o].toLowerCase()}`).join(", ") : "";
  return (
    <Section id="rep-losses" title="Lost deals" note={part.ok ? counts : undefined} download="losses" range={range}>
      {!part.ok ? (
        <Failed what="Lost deals" />
      ) : part.value.length === 0 ? (
        <Empty>No agreements were refused, expired or withdrawn in this range.</Empty>
      ) : (
        (["refused", "expired", "withdrawn"] as const).map((outcome) => {
          const rows = part.value.filter((r) => r.outcome === outcome);
          if (rows.length === 0) return null;
          return (
            <div key={outcome} className="flex flex-col gap-1">
              <h3 className="text-[13px] font-semibold">{OUTCOME_LABEL[outcome]} · {rows.length}</h3>
              <Rows>
                {rows.map((r) => (
                  <Row key={`${r.agreementId}-${r.outcome}`}>
                    <AgreementLink id={r.agreementId} number={r.number} />
                    <span>{r.customer}, {r.site}</span>
                    <span className="text-ink-2">{r.occurred}</span>
                    {money && r.valueCents !== null && <span className="text-ink-2">{formatCad(r.valueCents)} a year</span>}
                    {r.reason && <span className="basis-full text-ink-2">Reason: {r.reason}</span>}
                  </Row>
                ))}
              </Rows>
            </div>
          );
        })
      )}
    </Section>
  );
}

function RenewalsSection({ part, range, money }: { part: Part<RenewalRow[]>; range: ReportRange; money: boolean }) {
  if (!part) return null;
  return (
    <Section id="rep-renewals" title="Renewals due" note="Terms ending in the next 90 days that have no renewal yet." download="renewals" range={range}>
      {!part.ok ? (
        <Failed what="Renewals" />
      ) : part.value.length === 0 ? (
        <Empty>No term ends in the next 90 days.</Empty>
      ) : (
        ([30, 60, 90] as const).map((bucket) => {
          const rows = part.value.filter((r) => r.bucket === bucket);
          const low = bucket === 30 ? 0 : bucket - 29;
          return (
            <div key={bucket} className="flex flex-col gap-1">
              <h3 className="text-[13px] font-semibold">{low} to {bucket} days · {rows.length}</h3>
              {rows.length === 0 ? (
                <p className="text-[13px] text-ink-2">None.</p>
              ) : (
                <Rows>
                  {rows.map((r) => (
                    <Row key={r.agreementId}>
                      <AgreementLink id={r.agreementId} number={r.number} />
                      <span>{r.customer}, {r.site}</span>
                      <span className="text-ink-2">ends {r.termEnd}</span>
                      <span className="font-semibold">{r.kind === "auto" ? "Auto-renews" : "Needs negotiation"}</span>
                      {money && r.valueCents !== null && <span className="text-ink-2">{formatCad(r.valueCents)} a year</span>}
                    </Row>
                  ))}
                </Rows>
              )}
            </div>
          );
        })
      )}
    </Section>
  );
}

function RevenueSection({ id, title, note, download, range, part, label }: { id: string; title: string; note: string; download: ReportKey; range: ReportRange; part: Part<{ name: string; valueCents: number; extra?: string }[]>; label: string }) {
  if (!part) return null;
  return (
    <Section id={id} title={title} note={note} download={download} range={range}>
      {!part.ok ? (
        <Failed what={title} />
      ) : part.value.length === 0 ? (
        <Empty>No agreement is in term yet, so there is no revenue to split by {label}.</Empty>
      ) : (
        <Rows>
          {part.value.map((r) => (
            <Row key={r.name}>
              <span className="font-semibold">{r.name}</span>
              {r.extra && <span className="text-ink-2">{r.extra}</span>}
              <span className="ml-auto">{formatCadExact(r.valueCents)} a year</span>
            </Row>
          ))}
        </Rows>
      )}
    </Section>
  );
}

const named = <T, R>(part: Part<T[]>, to: (row: T) => R): Part<R[]> => (part === null ? null : part.ok ? { ok: true, value: part.value.map(to) } : part);

/** The Reports screen: headline, funnel, speed, losses, renewals and revenue, each with its own error line and CSV download. */
export function ReportsView({ range, notice, empty, headline, funnel, aging, losses, renewals, revenueByCustomer, revenueByType }: ReportsViewProps) {
  const money = headline !== null;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Reports" subtitle={`${range.from} to ${range.to}`} />
      <form method="get" action="/reports" className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card sm:flex-row sm:items-end">
        <TextInput id="rep-from" name="from" type="date" label="From" defaultValue={range.from} required className="sm:w-44" />
        <TextInput id="rep-to" name="to" type="date" label="To" defaultValue={range.to} required className="sm:w-44" />
        <Button type="submit" variant="primary">
          Apply range
        </Button>
        <LinkButton href="/reports" variant="secondary">
          Last 12 months
        </LinkButton>
      </form>
      {notice && (
        <p role="status" className="rounded-control bg-action-tint px-3 py-2.5 text-[13px] text-ink">
          {notice}
        </p>
      )}
      {empty ? (
        <EmptyPanel title="Nothing to report yet" text="Reports fill in as you send agreements. Start your first one and the figures appear here.">
          <LinkButton href="/agreements" variant="primary">
            New agreement
          </LinkButton>
        </EmptyPanel>
      ) : (
        <>
          <HeadlineSection part={headline} range={range} />
          <FunnelSection part={funnel} range={range} money={money} />
          <AgingSection part={aging} range={range} />
          <LossesSection part={losses} range={range} money={money} />
          <RenewalsSection part={renewals} range={range} money={money} />
          <RevenueSection
            id="rep-customer"
            title="Revenue by customer"
            note="Agreements in term today, a year of service each."
            download="revenue_customer"
            range={range}
            label="customer"
            part={named(revenueByCustomer, (r) => ({ name: r.customer, valueCents: r.valueCents, extra: `${r.agreements} ${r.agreements === 1 ? "agreement" : "agreements"}` }))}
          />
          <RevenueSection
            id="rep-type"
            title="Revenue by type"
            note="Each line's value split equally over the types it covers."
            download="revenue_type"
            range={range}
            label="type"
            part={named(revenueByType, (r) => ({ name: r.type, valueCents: r.valueCents }))}
          />
        </>
      )}
    </div>
  );
}
