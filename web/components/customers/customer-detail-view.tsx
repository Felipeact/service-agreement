import Link from "next/link";
import type { ReactNode } from "react";
import type { CustomerDetail, MemberRole } from "@/application/ports";
import { ShowInactiveToggle } from "@/components/records/show-inactive";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCad } from "@/lib/money";
import { STAGE_META } from "@/lib/pipeline-stage";

type SectionProps = { title: string; empty: string; isEmpty: boolean; action?: ReactNode; children: ReactNode };

function Section({ title, empty, isEmpty, action, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {action}
      </div>
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

const EDIT_LINK = "inline-flex min-h-11 min-w-11 items-center font-medium text-action lg:min-h-0 lg:min-w-0 md:ml-auto";

/** The customer record: contacts, sites and the agreements on those sites. Without a role it is read-only. */
export function CustomerDetailView({
  customer,
  role,
  showInactive = false,
}: {
  customer: CustomerDetail;
  role?: MemberRole;
  /** `?show=inactive`: list deactivated sites too (deactivation door 8). */
  showInactive?: boolean;
}) {
  const canWrite = role !== undefined && canWriteRecords(role);
  const sites = showInactive ? customer.sites : customer.sites.filter((site) => site.active);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/customers" className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
          Customers
        </Link>
        <PageHeader
          title={customer.name}
          badge={customer.active ? undefined : <StatusPill tone="neutral" label="Inactive" />}
          action={canWrite ? <LinkButton href={`/customers/${customer.id}/edit`}>Edit</LinkButton> : undefined} />
      </div>

      <Section
        title="Contacts"
        empty="No contacts yet"
        isEmpty={customer.contacts.length === 0}
        action={canWrite && <LinkButton href={`/customers/${customer.id}/contacts/new`}>Add contact</LinkButton>}
      >
        {customer.contacts.map((contact) => (
          <li key={contact.id} className={ROW}>
            <span className="font-semibold md:w-56">
              {contact.name}
              {(contact.roles ?? []).map((role) => (
                <span key={role.kind === "billing" ? "billing" : `${role.kind}:${role.site}`} className="ml-2 text-[12px] font-medium text-ink-2">
                  {role.kind === "billing" ? "Billing" : `${role.kind === "approver" ? "Approver" : "Site"} · ${role.site}`}
                </span>
              ))}
            </span>
            <span className="text-ink-2 md:w-72">
              <ContactLink href={`mailto:${contact.email}`} text={contact.email} />
            </span>
            <span className="text-ink-2">
              <ContactLink href={`tel:${contact.phone}`} text={contact.phone} />
            </span>
            {canWrite && (
              <Link href={`/contacts/${contact.id}/edit`} aria-label={`Edit ${contact.name}`} className={EDIT_LINK}>
                Edit
              </Link>
            )}
          </li>
        ))}
      </Section>

      <Section
        title="Sites"
        empty={customer.sites.length === 0 ? "No sites yet" : "No active sites."}
        isEmpty={sites.length === 0}
        action={
          (customer.sites.length > 0 || (canWrite && customer.active)) && (
            <div className="flex flex-wrap items-center gap-3">
              {customer.sites.length > 0 && <ShowInactiveToggle href={`/customers/${customer.id}`} showing={showInactive} />}
              {canWrite && customer.active && <LinkButton href={`/customers/${customer.id}/sites/new`}>Add site</LinkButton>}
            </div>
          )
        }
      >
        {sites.map((site) => (
          <li key={site.id} className={ROW}>
            <Link href={`/sites/${site.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-ink hover:text-action md:w-56 lg:min-h-0">
              {site.name}
              {!site.active && <StatusPill tone="neutral" label="Inactive" />}
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
          <li key={agreement.id}>
            <Link href={`/agreements/${agreement.id}`} data-agreement-row className={`${ROW} min-h-11 text-ink hover:bg-ground`}>
              <span className="font-semibold md:w-56">{agreement.siteName}</span>
              <span className="text-ink-2 md:w-40">
                {agreement.number ?? "Unnumbered"} · v{agreement.versionNo}
              </span>
              <StatusPill stage={agreement.stage} label={STAGE_META[agreement.stage].label} />
              {agreement.annualCents !== undefined && (
                <span className="font-semibold md:ml-auto">{formatCad(agreement.annualCents)}/yr</span>
              )}
            </Link>
          </li>
        ))}
      </Section>
    </div>
  );
}
