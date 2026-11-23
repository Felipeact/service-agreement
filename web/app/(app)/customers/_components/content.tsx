"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { CustomerSummary, MemberRole } from "@/application/ports";
import { SearchIcon } from "lucide-react";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { Spot } from "@/components/ui/illustrations";
import { Icon } from "@/components/ui/icons";
import { initialsOf } from "@/lib/initials";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCad } from "@/lib/money";
import { ContactTrigger, CustomerSheet, DetailsTrigger } from "./customer-sheet";
import { filterCustomers } from "./filter";

type StatusTab = "all" | "active" | "inactive";
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

type CustomersViewProps = {
  customers: CustomerSummary[];
  initialQuery?: string;
  /** Decides whether New customer shows; without a role the screen is read-only. */
  role?: MemberRole;
  /** `?show=inactive`: list deactivated customers too (deactivation door 8). */
  showInactive?: boolean;
};

/** The Customers page body: header with a count and search, then one row per customer. */
export function CustomersView({ customers, initialQuery = "", role, showInactive = false }: CustomersViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<StatusTab>(showInactive ? "all" : "active");
  const searchRef = useRef<HTMLInputElement>(null);
  const listed = customers.filter((customer) => status === "all" || customer.active === (status === "active"));
  const shown = filterCustomers(listed, query);
  const newCustomer = role && canWriteRecords(role) && (
    <LinkButton href="/customers/new" variant="primary">
      <Icon name="plus" className="size-4" />
      New customer
    </LinkButton>
  );

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        badge={customers.length > 0 ? <span className="inline-flex h-[22px] items-center rounded-full bg-action-tint px-2.5 text-[11px] font-semibold text-action-press">{customers.filter((customer) => customer.active).length} active</span> : undefined}
        subtitle="The companies you service, with their sites and agreements."
        action={newCustomer || undefined}
      />

      {customers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-3 shadow-card lg:flex-row lg:items-center">
          <label className="relative block lg:w-80">
            <span className="sr-only">Search customers</span>
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customers or contacts"
              className="h-11 w-full rounded-control border border-field bg-surface pr-3 pl-9 text-[14px] text-ink outline-none transition placeholder:text-ink-2 focus:border-action focus:ring-4 focus:ring-action/15 lg:h-10"
            />
          </label>
          <div role="tablist" aria-label="Status" className="-mx-1 flex gap-1 overflow-x-auto px-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={status === tab.key}
                onClick={() => setStatus(tab.key)}
                className={`inline-flex h-11 shrink-0 items-center rounded-control px-3 text-[13px] font-semibold transition-colors lg:h-9 ${status === tab.key ? "bg-action-tint text-action-press" : "text-ink-nav hover:bg-board hover:text-ink"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {customers.length === 0 ? (
        <EmptyPanel title="No customers yet" text="Customers appear here once they are added or imported." art={<Spot kind="people" />}>
          {newCustomer}
        </EmptyPanel>
      ) : listed.length === 0 ? (
        <EmptyPanel title={status === "inactive" ? "No inactive customers." : "No active customers."} />
      ) : shown.length === 0 ? (
        <EmptyPanel title={`No customers match "${query}"`}>
          <Button onClick={clearSearch}>Clear search</Button>
        </EmptyPanel>
      ) : (
        <ul className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((customer) => (
            <li key={customer.id}>
              <CustomerSheet customer={customer} canEdit={Boolean(role && canWriteRecords(role))}>
                <div className="group relative flex h-full flex-col rounded-panel border border-hairline bg-surface shadow-card transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-lift">
                  <span className="flex items-start gap-3 p-5 pb-4">
                    <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-action-tint text-[15px] font-bold text-action-press">
                      {initialsOf(customer.name)}
                    </span>
                    <span className="min-w-0 flex-1 text-[16px] leading-snug font-semibold tracking-tight break-words text-ink">
                      <Link href={`/customers/${customer.id}`} className="relative z-10 inline-flex min-h-11 items-center hover:text-action lg:min-h-0">
                        {customer.name}
                      </Link>
                    </span>
                    {customer.active ? <StatusPill stage="completed" filled label="Active" /> : <StatusPill tone="neutral" label="Inactive" />}
                  </span>
                  <span className="grid grid-cols-3 gap-2 border-y border-hairline px-5 py-3 text-center">
                    {[
                      ["Agreements", customer.agreementCount],
                      ["Sites", customer.siteCount],
                      ["Per year", formatCad(customer.annualCents ?? 0)],
                    ].map(([label, count]) => (
                      <span key={label} className="flex flex-col">
                        <span className="text-[16px] font-bold tabular-nums">{count}</span>
                        <span className="text-[11px] text-ink-2">{label}</span>
                      </span>
                    ))}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-3 px-5 py-3 text-[12px] text-ink-2">
                    <ContactTrigger customer={customer} />
                    <DetailsTrigger />
                  </span>
                </div>
              </CustomerSheet>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
