import Link from "next/link";
import type { ReactNode } from "react";
import type { CustomerDetail, MemberRole } from "@/application/ports";
import { ShowInactiveToggle } from "@/components/records/show-inactive";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { StatusPill } from "@/components/ui/status-pill";
import { initialsOf } from "@/lib/initials";
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

/** One cell of the title block: a small label over a figure, in the way a drawing sheet's title block files its facts. */
function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:px-5">
      <dt className="text-[12px] font-medium text-ink-2">{label}</dt>
      <dd className="text-[22px] leading-7 font-semibold tracking-tight tabular-nums">{value}</dd>
      {note && <dd className="text-[12px] text-ink-2">{note}</dd>}
    </div>
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
  const activeSites = customer.sites.filter((site) => site.active);
  const assets = activeSites.reduce((sum, site) => sum + site.assetCount, 0);
  const priced = customer.agreements.filter((agreement) => agreement.annualCents !== undefined && (agreement.stage === "accepted" || agreement.stage === "completed"));
  const signedCents = priced.reduce((sum, agreement) => sum + (agreement.annualCents ?? 0), 0);
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

      <div className="flex flex-col overflow-hidden rounded-panel border border-hairline bg-surface shadow-card md:flex-row">
        <div className="flex items-center gap-3 border-b border-hairline bg-action-tint px-4 py-3 text-ink sm:px-5 md:w-56 md:shrink-0 md:border-r md:border-b-0 md:py-4">
          <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-action text-[15px] font-bold text-surface shadow-md shadow-action/25">
            {initialsOf(customer.name)}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[12px] text-ink-2">{customer.active ? "Active customer" : "Inactive customer"}</span>
            <span className="truncate text-[14px] font-semibold">{customer.name}</span>
          </span>
        </div>
        <dl className="grid flex-1 grid-cols-2 divide-x divide-hairline md:grid-cols-4 max-md:[&>div:nth-child(n+3)]:border-t max-md:[&>div:nth-child(n+3)]:border-hairline">
          <Fact label="Sites" value={String(activeSites.length)} />
          <Fact label="Assets" value={String(assets)} note="on those sites" />
          <Fact label="Agreements" value={String(customer.agreements.length)} />
          <Fact label="Signed value" value={formatCad(signedCents)} note="per year" />
        </dl>
      </div>

      <Section
        title="Contacts"
        empty="No contacts yet"
        isEmpty={customer.contacts.length === 0}
        action={canWrite && <LinkButton href={`/customers/${customer.id}/contacts/new`}>Add contact</LinkButton>}
      >
        {customer.contacts.map((contact) => (
          <li key={contact.id} className={ROW}>
            <span className="flex items-center gap-3 font-semibold md:w-56">
              <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-board text-[12px] font-semibold text-ink-2">
                {initialsOf(contact.name)}
              </span>
              <span>
              {contact.name}
              {(contact.roles ?? []).length > 0 && (
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] font-medium text-ink-2">
                  {(contact.roles ?? []).map((role) => (
                    <span key={role.kind === "billing" ? "billing" : `${role.kind}:${role.site}`}>
                      {role.kind === "billing" ? "Billing" : `${role.kind === "approver" ? "Approver" : "Site"} · ${role.site}`}
                    </span>
                  ))}
                </span>
              )}
              </span>
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
