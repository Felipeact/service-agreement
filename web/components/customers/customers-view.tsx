"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { CustomerSummary, MemberRole } from "@/application/ports";
import { ShowInactiveToggle } from "@/components/records/show-inactive";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { Spot } from "@/components/ui/illustrations";
import { Icon } from "@/components/ui/icons";
import { Initials } from "@/components/ui/list-panel";
import { SearchInput } from "@/components/ui/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { filterCustomers } from "./filter";

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
  const searchRef = useRef<HTMLInputElement>(null);
  const listed = showInactive ? customers : customers.filter((customer) => customer.active);
  const shown = filterCustomers(listed, query);
  const sites = listed.reduce((sum, customer) => sum + customer.siteCount, 0);
  const assets = listed.reduce((sum, customer) => sum + customer.assetCount, 0);
  const standing = [
    `${listed.length} ${listed.length === 1 ? "customer" : "customers"}`,
    `${sites} ${sites === 1 ? "site" : "sites"}`,
    `${assets} ${assets === 1 ? "asset" : "assets"}`,
  ].join(" · ");
  const toggle = <ShowInactiveToggle href="/customers" showing={showInactive} />;
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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Customers"
        subtitle={listed.length > 0 ? standing : undefined}
        controls={
          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
            <SearchInput
              ref={searchRef}
              label="Search customers"
              placeholder="Search customers…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full md:w-60"
            />
            {customers.length > 0 && toggle}
          </div>
        }
        action={newCustomer || undefined}
      />

      {customers.length === 0 ? (
        <EmptyPanel title="No customers yet" text="Customers appear here once they are added or imported." art={<Spot kind="people" />}>
          {newCustomer}
        </EmptyPanel>
      ) : listed.length === 0 ? (
        <EmptyPanel title="No active customers.">{toggle}</EmptyPanel>
      ) : shown.length === 0 ? (
        <EmptyPanel title={`No customers match "${query}"`}>
          <Button onClick={clearSearch}>Clear search</Button>
        </EmptyPanel>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4">
          {shown.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/customers/${customer.id}`}
                className="flex h-full flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-lift"
              >
                <Initials name={customer.name} large />
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[18px] leading-snug font-semibold tracking-tight text-ink">{customer.name}</span>
                  {!customer.active && <StatusPill tone="neutral" label="Inactive" />}
                </span>
                <span className="grid grid-cols-2 gap-4 border-t border-hairline pt-4">
                  <span className="flex flex-col">
                    <span className="text-[12px] text-ink-2">Sites</span>
                    <span className="font-display text-[22px] leading-tight font-medium tracking-tight">{customer.siteCount}</span>
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[12px] text-ink-2">Assets</span>
                    <span className="font-display text-[22px] leading-tight font-medium tracking-tight">{customer.assetCount}</span>
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[12px] text-ink-2">Primary contact</span>
                    <span className="truncate text-[13px] font-semibold text-ink">{customer.primaryContact ?? "No contact yet"}</span>
                  </span>
                  <Icon name="chevron" className="size-4 text-ink-2" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
