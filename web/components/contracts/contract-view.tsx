import Link from "next/link";
import type { ReactNode } from "react";
import type { AgreementDetail, ContractDetail } from "@/application/ports";
import { LineRow } from "@/components/agreements/line-row";
import { SigningArea, type SigningAreaProps } from "./signing-area";
import { VisitScheduleSection } from "@/components/agreements/visit-schedule";
import { PageHeader } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { termsOf, termSummary, visitSchedule } from "@/domain/agreement";
import { CONTRACT_STATUS_META } from "@/domain/contract";
import { formatDay, notEmailedWords } from "@/domain/notifications";
import { formatCadExact } from "@/lib/money";

type ContractViewProps = {
  contract: ContractDetail;
  /** The agreement at the contract's own version: its lines, scope and frozen terms are the contract's. */
  agreement: AgreementDetail;
  /** The signing section's inputs, read by the page for this member; absent where nothing about signing is shown. */
  signing?: SigningAreaProps;
};

const link = "inline-flex min-h-11 items-center font-medium text-action lg:min-h-0";

/** A labelled value in the parties and terms panels. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[12px] font-medium text-ink-2">{label}</dt>
      <dd className="text-[13px] break-words">{children}</dd>
    </div>
  );
}

/** The contract page body: who it binds, the term, the accepted lines and total, the schedule and the terms. Read-only. */
export function ContractView({ contract, agreement, signing }: ContractViewProps) {
  const { parties } = contract;
  const { shown } = agreement;
  const meta = CONTRACT_STATUS_META[contract.status];
  const terms = agreement.terms ? termsOf(agreement.terms, agreement.term.months) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-x-3 text-[13px]">
          <Link href={`/customers/${agreement.customer.id}`} className={link}>
            {parties?.customer.name ?? agreement.customer.name}
          </Link>
          <Link href={`/sites/${agreement.site.id}`} className={link}>
            {parties?.site.name ?? agreement.site.name}
          </Link>
          <Link href={`/agreements/${contract.agreementId}`} className={link}>
            Agreement {contract.number}
          </Link>
          {/* A file download, not a page: a plain anchor so the browser saves it. */}
          {parties && (
            <a href={`/contracts/${contract.id}/pdf`} className={link}>
              Download PDF
            </a>
          )}
        </div>
        <PageHeader title={`Contract · ${contract.number}`} badge={<StatusPill tone={meta.tone} label={meta.label} />} />
      </div>

      <section aria-label="Parties" className="rounded-panel border border-hairline bg-surface px-4 py-3">
        <h2 className="mb-2 text-[13px] font-semibold">Parties</h2>
        {parties ? (
          <dl className="grid gap-3 md:grid-cols-2">
            <Fact label="Contractor">
              {parties.contractor.legalName}
              {parties.contractor.address && <span className="block text-ink-2">{parties.contractor.address}</span>}
              {parties.contractor.phone && <span className="block text-ink-2">{parties.contractor.phone}</span>}
            </Fact>
            <Fact label="Customer">{parties.customer.name}</Fact>
            <Fact label="Site">
              {parties.site.name}
              {parties.site.address && <span className="block text-ink-2">{parties.site.address}</span>}
            </Fact>
            <Fact label="Signer">
              {parties.signer ? (
                <>
                  {parties.signer.name}
                  <span className="block text-ink-2">{parties.signer.email}</span>
                </>
              ) : (
                "No signer recorded"
              )}
            </Fact>
          </dl>
        ) : (
          <p className="text-[13px] text-ink-2">Parties not recorded for this contract.</p>
        )}
      </section>

      {signing && <SigningArea {...signing} />}
      {contract.signingLinkEmail && contract.signingLinkEmail.status !== "pending" && (
        <p data-signing-link-email className="text-[13px] text-ink-2">
          {contract.signingLinkEmail.status === "sent"
            ? `Signing link emailed to ${contract.signingLinkEmail.to} on ${formatDay(contract.signingLinkEmail.sentAt)}`
            : `The signing link email did not go out: ${notEmailedWords(contract.signingLinkEmail.reason)}`}
        </p>
      )}

      <section aria-label="Term" className="rounded-panel border border-hairline bg-surface px-4 py-3">
        <h2 className="mb-1 text-[13px] font-semibold">Term</h2>
        <p data-term className="text-[13px] text-ink-2">
          {termSummary(agreement.term)}
        </p>
      </section>

      <section aria-label="Service lines" className="overflow-hidden rounded-panel border border-hairline bg-surface">
        <h2 className="border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold">Service lines</h2>
        {shown.lines.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-2">No service lines.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {shown.lines.map((line) => (
              <LineRow key={line.id} line={line} choices={[]} />
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline px-4 py-3">
          <p className="text-[14px] font-semibold">
            Total per year <span>{formatCadExact(shown.annualCents)}</span>
          </p>
          <p className="text-[12px] text-ink-2">Before tax</p>
        </div>
      </section>

      <VisitScheduleSection schedule={visitSchedule(shown.lines, agreement.serviceScope.source === "not_recorded" ? [] : agreement.serviceScope.types)} />

      {terms.length > 0 && (
        <section aria-label="Terms" className="rounded-panel border border-hairline bg-surface px-4 py-3">
          <h2 className="mb-2 text-[13px] font-semibold">Terms</h2>
          <dl className="grid gap-3 md:grid-cols-2">
            {terms.map((term) => (
              <Fact key={term.label} label={term.label}>
                {term.value}
              </Fact>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
