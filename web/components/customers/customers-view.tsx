"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { CustomerSummary, MemberRole } from "@/application/ports";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { SearchInput } from "@/components/ui/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { filterCustomers } from "./filter";

const COLUMNS = "md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_5rem_5rem]";

type CustomersViewProps = {
  customers: CustomerSummary[];
  initialQuery?: string;
  /** Decides whether New customer shows; without a role the screen is read-only. */
  role?: MemberRole;
};

/** The Customers page body: header with a count and search, then one row per customer. */
export function CustomersView({ customers, initialQuery = "", role }: CustomersViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLInputElement>(null);
  const shown = filterCustomers(customers, query);
  const count = `${customers.length} ${customers.length === 1 ? "customer" : "customers"}`;
  const newCustomer = role && canWriteRecords(role) && (
    <LinkButton href="/customers/new" variant="primary">
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
        badge={customers.length > 0 ? <StatusPill tone="neutral" label={count} /> : undefined}
        controls={
          <SearchInput
            ref={searchRef}
            label="Search customers"
            placeholder="Search customers…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full md:w-60"
          />
        }
        action={newCustomer || undefined}
      />

      {customers.length === 0 ? (
        <EmptyPanel title="No customers yet" text="Customers appear here once they are added or imported.">
          {newCustomer}
        </EmptyPanel>
      ) : shown.length === 0 ? (
        <EmptyPanel title={`No customers match "${query}"`}>
          <Button onClick={clearSearch}>Clear search</Button>
        </EmptyPanel>
      ) : (
        <div className="overflow-hidden rounded-panel border border-hairline bg-surface">
          <div
            aria-hidden="true"
            className={`hidden border-b border-hairline bg-ground px-4 py-2 text-[11px] font-semibold text-ink-2 md:grid md:gap-x-3 ${COLUMNS}`}
          >
            <span>Customer</span>
            <span>Primary contact</span>
            <span>Sites</span>
            <span>Assets</span>
          </div>
          <ul className="divide-y divide-hairline">
            {shown.map((customer) => (
              <li key={customer.id} className={`grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 md:items-center ${COLUMNS}`}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="col-span-2 inline-flex min-h-11 items-center text-[13.5px] font-semibold text-ink hover:text-action md:col-span-1 lg:min-h-0"
                >
                  {customer.name}
                </Link>
                <span className="col-span-2 text-ink-2 md:col-span-1">{customer.primaryContact ?? "-"}</span>
                <span className="text-ink-2">
                  <span className="md:hidden">Sites </span>
                  {customer.siteCount}
                </span>
                <span className="text-ink-2">
                  <span className="md:hidden">Assets </span>
                  {customer.assetCount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
