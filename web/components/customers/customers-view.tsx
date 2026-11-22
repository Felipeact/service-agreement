"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { CustomerSummary, MemberRole } from "@/application/ports";
import { ChevronRightIcon, PlusIcon, UserIcon } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
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
  const words = useItemWords();
  const [query, setQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLInputElement>(null);
  const listed = showInactive ? customers : customers.filter((customer) => customer.active);
  const shown = filterCustomers(listed, query);
  const sites = listed.reduce((sum, customer) => sum + customer.siteCount, 0);
  const assets = listed.reduce((sum, customer) => sum + customer.assetCount, 0);
  const standing = [
    `${listed.length} active ${listed.length === 1 ? "customer" : "customers"}`,
    `${sites} ${sites === 1 ? "site" : "sites"}`,
    `${assets} ${assets === 1 ? "asset" : "assets"} under service pacts`,
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
        badge={listed.length > 0 ? <StatusPill stage="completed" filled label={`${customers.filter((customer) => customer.active).length} Active`} /> : undefined}
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

      {listed.length > 0 && (
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
          <StatCard label="Total Customers" value={String(listed.length)} note={showInactive ? "Including inactive" : "Active customers"} />
          <StatCard label="Managed Sites" value={String(sites)} note={`Across ${listed.length} ${listed.length === 1 ? "customer" : "customers"}`} />
          <StatCard label={itemText("Equipment Assets", words)} value={String(assets)} note="units tracked" />
        </div>
      )}

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
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 lg:gap-4">
          {shown.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/customers/${customer.id}`}
                className="group flex h-full flex-col rounded-panel border border-hairline bg-surface shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-lift"
              >
                <span className="flex items-start gap-3 p-5 pb-4">
                  <Initials name={customer.name} large />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[16px] leading-snug font-semibold tracking-tight break-words text-ink">{customer.name}</span>
                    <span className="flex">{customer.active ? <StatusPill stage="completed" filled label="Active" /> : <StatusPill tone="neutral" label="Inactive" />}</span>
                  </span>
                </span>
                <span className="mx-5 grid grid-cols-2 gap-4 rounded-control bg-ground px-4 py-3">
                  <span className="flex flex-col">
                    <span className="text-[12px] text-ink-2">Sites</span>
                    <span className="text-[22px] leading-tight font-semibold tracking-tight">{customer.siteCount}</span>
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[12px] text-ink-2">Assets</span>
                    <span className="text-[22px] leading-tight font-semibold tracking-tight">{customer.assetCount}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 px-5 pt-4 pb-4 text-[13px]">
                  <UserIcon aria-hidden="true" className="size-4 shrink-0 text-ink-2" />
                  <span className="min-w-0">
                    <span className="text-ink-2">Primary contact </span>
                    <span className="truncate font-semibold text-ink">{customer.primaryContact ?? "No contact yet"}</span>
                  </span>
                </span>
                <span className="mt-auto flex min-h-11 items-center justify-between gap-2 border-t border-hairline px-5 text-[13px] font-semibold text-action">
                  View customer details
                  <ChevronRightIcon aria-hidden="true" className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
          {newCustomer && !query.trim() && (
            <li>
              <Link
                href="/customers/new"
                className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line-strong bg-surface/60 p-6 text-center transition-colors duration-150 hover:border-action hover:bg-action-tint/40"
              >
                <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full bg-action-tint text-action">
                  <PlusIcon className="size-5" />
                </span>
                <span className="text-[15px] font-semibold text-ink">Add New Customer</span>
                <span className="max-w-[28ch] text-[13px] text-ink-2">{itemText("Connect customer facility portfolios and start attaching equipment lists or agreements.", words)}</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
