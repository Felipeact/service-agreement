import Link from "next/link";
import type { ReactNode } from "react";
import type { CustomerDetail } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCad } from "@/lib/money";
import { STAGE_META } from "@/lib/pipeline-stage";

type SectionProps = { title: string; empty: string; isEmpty: boolean; children: ReactNode };

function Section({ title, empty, isEmpty, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {isEmpty ? (
        <p className="rounded-panel border border-hairline bg-surface px-4 py-6 text-center text-[13px] text-ink-2">{empty}</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-panel border border-hairline bg-surface">{children}</ul>
      )}
    </section>
  );
}

const ROW = "flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-4";
const value = (text: string | null) => text ?? "-";

function ContactLink({ href, text }: { href: string; text: string | null }) {
  if (!text) return <>-</>;
  return (
    <a href={href} className="inline-flex min-h-11 items-center text-action lg:min-h-0">
      {text}
    </a>
  );
}

/** The customer record: contacts, sites and the agreements on those sites. */
export function CustomerDetailView({ customer }: { customer: CustomerDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/customers" className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
          Customers
        </Link>
        <PageHeader title={customer.name} />
      </div>

      <Section title="Contacts" empty="No contacts yet" isEmpty={customer.contacts.length === 0}>
        {customer.contacts.map((contact) => (
          <li key={contact.id} className={ROW}>
            <span className="font-semibold md:w-56">{contact.name}</span>
            <span className="text-ink-2 md:w-72">
              <ContactLink href={`mailto:${contact.email}`} text={contact.email} />
            </span>
            <span className="text-ink-2">
              <ContactLink href={`tel:${contact.phone}`} text={contact.phone} />
            </span>
          </li>
        ))}
      </Section>

      <Section title="Sites" empty="No sites yet" isEmpty={customer.sites.length === 0}>
        {customer.sites.map((site) => (
          <li key={site.id} className={ROW}>
            <Link href={`/sites/${site.id}`} className="inline-flex min-h-11 items-center font-semibold text-ink hover:text-action md:w-56 lg:min-h-0">
              {site.name}
            </Link>
            <span className="text-ink-2 md:flex-1">{value(site.address)}</span>
            <span className="text-ink-2">{value(site.contactName)}</span>
            <span className="text-ink-2">
              {site.assetCount} {site.assetCount === 1 ? "asset" : "assets"}
            </span>
          </li>
        ))}
      </Section>

      <Section title="Agreements" empty="No agreements yet" isEmpty={customer.agreements.length === 0}>
        {customer.agreements.map((agreement) => (
          <li key={agreement.id} className={ROW}>
            <span className="font-semibold md:w-56">{agreement.siteName}</span>
            <span className="text-ink-2 md:w-40">
              {agreement.number ?? "Unnumbered"} · v{agreement.versionNo}
            </span>
            <StatusPill stage={agreement.stage} label={STAGE_META[agreement.stage].label} />
            {agreement.annualCents !== undefined && (
              <span className="font-semibold md:ml-auto">{formatCad(agreement.annualCents)}/yr</span>
            )}
          </li>
        ))}
      </Section>
    </div>
  );
}
