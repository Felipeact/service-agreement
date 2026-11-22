"use client";

import Link from "next/link";
import { ChevronRightIcon, MailIcon, PhoneIcon, UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { CustomerSummary } from "@/application/ports";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { initialsOf } from "@/lib/initials";

/** The primary contact's name on a card; it opens the panel. Place it inside `CustomerSheet`. */
export function ContactTrigger({ customer }: { customer: CustomerSummary }) {
  const contact = customer.primaryContact;
  return (
    <SheetTrigger asChild>
      <button
        type="button"
        className="relative z-10 -mx-1 flex min-h-11 items-center gap-2 rounded-control px-1 text-left text-[13px] transition-colors duration-150 hover:bg-board lg:min-h-0"
      >
        <UserIcon aria-hidden="true" className="size-4 shrink-0 text-ink-2" />
        <span className="min-w-0 truncate">
          <span className="font-semibold text-ink">{contact ?? "No contact yet"}</span>
          {contact && <span className="text-[12px] text-ink-2"> (Primary)</span>}
        </span>
      </button>
    </SheetTrigger>
  );
}

/** "View customer details" on a card: it opens the panel, and stretches over the whole card so any tap on it does the same. */
export function DetailsTrigger() {
  return (
    <SheetTrigger asChild>
      <button type="button" className="inline-flex items-center gap-1 text-[13px] font-semibold text-action after:absolute after:inset-0">
        View customer details
        <ChevronRightIcon aria-hidden="true" className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
    </SheetTrigger>
  );
}

const FACT = "flex flex-col gap-0.5 rounded-control border border-hairline bg-ground px-3 py-2.5";
const ROUND_LINK =
  "inline-flex size-11 items-center justify-center rounded-control border border-hairline bg-surface text-ink-2 transition-colors duration-150 hover:bg-board hover:text-action";

/**
 * "Contact Details": a panel that slides in from the right with the customer's primary contact
 * (docs/service_pacts_customer_details_modal_view). It shows only what the record holds: the contact's name, email and
 * phone, and the customer's sites, assets and agreements. `canEdit` shows the Edit contact link for a member who may write records.
 */
export function CustomerSheet({ customer, canEdit, children }: { customer: CustomerSummary; canEdit: boolean; children: ReactNode }) {
  const contact = customer.primaryContact;
  return (
    <Sheet>
      {children}
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-hairline px-5 py-4">
          <SheetTitle className="text-[16px] font-semibold tracking-tight">Contact Details</SheetTitle>
          <SheetDescription className="sr-only">{`The primary contact of ${customer.name}.`}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <span aria-hidden="true" className="inline-flex size-20 items-center justify-center rounded-full bg-action text-[26px] font-semibold text-surface shadow-lift">
              {initialsOf(contact ?? customer.name)}
            </span>
            <h3 className="mt-2 text-[20px] leading-7 font-semibold tracking-tight">{contact ?? "No contact yet"}</h3>
            <p className="text-[13px] text-ink-2">{contact ? `Primary contact · ${customer.name}` : customer.name}</p>
            <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${customer.active ? "border-pill-completed-border bg-pill-completed text-pill-completed-ink" : "border-hairline bg-board text-ink-2"}`}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${customer.active ? "bg-stage-completed" : "bg-ink-2"}`} />
              {customer.active ? "Active customer" : "Inactive customer"}
            </span>
          </div>

          {(customer.primaryPhone || customer.primaryEmail) && (
            <div className="flex flex-col items-center gap-2 border-y border-hairline py-4 text-[13px]">
              <div className="flex gap-2">
                {customer.primaryPhone && (
                  <a href={`tel:${customer.primaryPhone}`} aria-label={`Call ${contact ?? customer.name}`} className={ROUND_LINK}>
                    <PhoneIcon aria-hidden="true" className="size-4" />
                  </a>
                )}
                {customer.primaryEmail && (
                  <a href={`mailto:${customer.primaryEmail}`} aria-label={`Email ${contact ?? customer.name}`} className={ROUND_LINK}>
                    <MailIcon aria-hidden="true" className="size-4" />
                  </a>
                )}
              </div>
              {customer.primaryEmail && <span className="text-ink-2">{customer.primaryEmail}</span>}
              {customer.primaryPhone && <span className="text-ink-2">{customer.primaryPhone}</span>}
            </div>
          )}

          <dl className="grid grid-cols-3 gap-2.5">
            <div className={FACT}>
              <dt className="text-[12px] text-ink-2">Sites</dt>
              <dd className="text-[18px] font-semibold tabular-nums">{customer.siteCount}</dd>
            </div>
            <div className={FACT}>
              <dt className="text-[12px] text-ink-2">Assets</dt>
              <dd className="text-[18px] font-semibold tabular-nums">{customer.assetCount}</dd>
            </div>
            <div className={FACT}>
              <dt className="text-[12px] text-ink-2">Agreements</dt>
              <dd className="text-[18px] font-semibold text-action tabular-nums">{customer.agreementCount}</dd>
            </div>
          </dl>

          {customer.agreementNumbers.length > 0 && <p className="font-mono text-[12px] text-ink-2">{customer.agreementNumbers.join(" · ")}</p>}
        </div>
        <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-hairline bg-ground px-5 py-3">
          <Link href={`/customers/${customer.id}`} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-action lg:min-h-0">
            Open customer
          </Link>
          <span className="hidden font-mono text-[11px] text-ink-2 sm:inline">ID: {customer.id.slice(0, 8)}</span>
          <div className="flex items-center gap-2">
            <SheetClose asChild>
              <Button>Close</Button>
            </SheetClose>
            {canEdit && customer.primaryContactId && (
              <LinkButton href={`/contacts/${customer.primaryContactId}/edit`} variant="primary">
                Edit contact
              </LinkButton>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
