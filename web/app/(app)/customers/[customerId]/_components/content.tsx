import Link from "next/link";
import { MapPinIcon, PlusIcon } from "lucide-react";
import type { CustomerDetail, MemberRole } from "@/application/ports";
import { ShowInactiveToggle } from "@/components/records/show-inactive";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { SectionPanel } from "@/components/ui/section-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { initialsOf } from "@/lib/initials";
import { formatCad } from "@/lib/money";
import { STAGE_META } from "@/lib/pipeline-stage";

const value = (text: string | null) => text ?? "-";

function ContactLink({ href, text }: { href: string; text: string | null }) {
  if (!text) return <>-</>;
  return (
    <a href={href} className="inline-flex min-h-11 items-center text-action lg:min-h-0">
      {text}
    </a>
  );
}

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <Link href="/customers" className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-action hover:underline lg:min-h-8">
          <span aria-hidden="true">←</span> Customers
        </Link>
        <PageHeader
          title={customer.name}
          badge={customer.active ? <StatusPill stage="completed" filled label="Active" /> : <StatusPill tone="neutral" label="Inactive" />}
          subtitle={`${customer.agreements.length} ${customer.agreements.length === 1 ? "agreement" : "agreements"} · ${formatCad(signedCents)}/yr signed · ${activeSites.length} ${activeSites.length === 1 ? "site" : "sites"} · ${assets} ${assets === 1 ? "asset" : "assets"}`}
          action={
            canWrite ? (
              <>
                <LinkButton href={`/customers/${customer.id}/edit`}>Edit customer</LinkButton>
                <LinkButton href={`/customers/${customer.id}/contacts/new`}>Add contact</LinkButton>
                {customer.active && (
                  <LinkButton href={`/customers/${customer.id}/sites/new`} variant="primary">
                    <PlusIcon aria-hidden="true" />
                    Add site
                  </LinkButton>
                )}
              </>
            ) : undefined
          }
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6 xl:order-1">
      <SectionPanel id="customer-agreements" title="Agreements" flush>
        {customer.agreements.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-2">No agreements yet</p>
        ) : (
          <>
            <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_9rem_7rem] gap-4 border-b border-hairline bg-ground/70 px-5 py-2.5 text-[12px] font-semibold text-ink-2 md:grid">
              <span>Agreement</span>
              <span>Stage</span>
              <span className="text-right">Per year</span>
            </div>
            <ul className="divide-y divide-hairline">
              {customer.agreements.map((agreement) => (
                <li key={agreement.id}>
                  <Link href={`/agreements/${agreement.id}`} data-agreement-row className="flex min-h-11 flex-col gap-1 px-4 py-3 text-ink hover:bg-ground/70 md:grid md:grid-cols-[minmax(0,1fr)_9rem_7rem] md:items-center md:gap-4 md:px-5">
                    <span>
                      <span className="block font-semibold text-action">{agreement.siteName}</span>
                      <span className="block text-[12px] text-ink-2">
                        {agreement.number ?? "Unnumbered"} · v{agreement.versionNo}
                      </span>
                    </span>
                    <span>
                      <StatusPill stage={agreement.stage} label={STAGE_META[agreement.stage].label} />
                    </span>
                    <span className="font-semibold md:text-right">{agreement.annualCents !== undefined ? `${formatCad(agreement.annualCents)}/yr` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionPanel>

      <SectionPanel
        id="customer-sites"
        title="Sites"
        action={customer.sites.length > 0 ? <ShowInactiveToggle href={`/customers/${customer.id}`} showing={showInactive} /> : undefined}
      >
        {sites.length === 0 ? (
          <p className="py-2 text-center text-[13px] text-ink-2">{customer.sites.length === 0 ? "No sites yet" : "No active sites."}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {sites.map((site) => (
              <li key={site.id} className="relative flex min-h-11 items-start gap-3 rounded-card border border-hairline p-3 hover:border-action hover:bg-action-tint">
                <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-action" />
                <span className="min-w-0 text-[14px]">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    <Link href={`/sites/${site.id}`} className="after:absolute after:inset-0">{site.name}</Link>
                    {!site.active && <StatusPill tone="neutral" label="Inactive" />}
                  </span>
                  <span className="block text-[12px] text-ink-2">
                    {value(site.address)} · {site.assetCount} {site.assetCount === 1 ? "asset" : "assets"}
                  </span>
                  {site.contactName && <span className="block text-[12px] text-ink-2">{site.contactName}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
      </div>
      <div className="min-w-0 xl:order-2">
      <SectionPanel id="customer-contacts" title="Contacts" action={canWrite ? <LinkButton href={`/customers/${customer.id}/contacts/new`}>Add</LinkButton> : undefined}>
        {customer.contacts.length === 0 ? (
          <p className="py-2 text-center text-[13px] text-ink-2">No contacts yet</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {customer.contacts.map((contact) => (
              <li key={contact.id} className="flex items-center gap-3">
                <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-board text-[12px] font-semibold text-ink-2">
                  {initialsOf(contact.name)}
                </span>
                <span className="min-w-0 flex-1 text-[14px]">
                  <span className="block font-semibold">{contact.name}</span>
                  {(contact.roles ?? []).length > 0 && (
                    <span className="flex flex-wrap gap-x-3 text-[12px] text-ink-2">
                      {(contact.roles ?? []).map((role) => (
                        <span key={role.kind === "billing" ? "billing" : `${role.kind}:${role.site}`}>
                          {role.kind === "billing" ? "Billing" : `${role.kind === "approver" ? "Approver" : "Site"} · ${role.site}`}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="block truncate text-[12px] text-ink-2">
                    <ContactLink href={`mailto:${contact.email}`} text={contact.email} />
                  </span>
                  <span className="block text-[12px] text-ink-2">
                    <ContactLink href={`tel:${contact.phone}`} text={contact.phone} />
                  </span>
                </span>
                {canWrite && (
                  <Link href={`/contacts/${contact.id}/edit`} aria-label={`Edit ${contact.name}`} className="inline-flex h-11 min-w-11 items-center justify-center rounded-control px-3 text-[13px] font-semibold text-ink-nav hover:bg-board hover:text-ink lg:h-9">
                    Edit
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      </div>
      </div>
    </div>
  );
}
