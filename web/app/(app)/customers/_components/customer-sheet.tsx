"use client";

import Link from "next/link";
import { MailIcon, PhoneIcon, UserIcon } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { CustomerSummary } from "@/application/ports";
import { LinkButton } from "@/components/ui/link-button";
import { Modal } from "@/components/ui/modal";

const OpenContext = createContext<() => void>(() => {});

/** The primary contact's name on a card; it opens the details. Place it inside `CustomerSheet`. */
export function ContactTrigger({ customer }: { customer: CustomerSummary }) {
  const open = useContext(OpenContext);
  const contact = customer.primaryContact;
  return (
    <button type="button" aria-haspopup="dialog" onClick={open} className="relative z-10 flex min-h-11 min-w-0 items-center text-left text-[12px] text-ink-2 lg:min-h-0">
      <span className="truncate">{contact ?? "No contact yet"}</span>
    </button>
  );
}

/** "View details" on a card: it opens the details, and stretches over the whole card so any tap on it does the same. */
export function DetailsTrigger() {
  const open = useContext(OpenContext);
  return (
    <button type="button" aria-haspopup="dialog" onClick={open} className="-mr-2 inline-flex h-11 items-center rounded-control px-3 text-[13px] font-semibold text-action hover:bg-board after:absolute after:inset-0 lg:h-[38px]">
      View details
    </button>
  );
}

/**
 * The customer's quick look, a modal over the list so you never lose your place: the primary contact's name, email and phone,
 * and the customer's counts in its note. It shows only what the record holds. `canEdit` shows Edit contact to a member who may write records.
 */
export function CustomerSheet({ customer, canEdit, children }: { customer: CustomerSummary; canEdit: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contact = customer.primaryContact;
  return (
    <OpenContext.Provider value={() => setOpen(true)}>
      {children}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={customer.name}
        sub={`${customer.agreementCount} ${customer.agreementCount === 1 ? "agreement" : "agreements"} · ${customer.siteCount} ${customer.siteCount === 1 ? "site" : "sites"} · ${customer.active ? "Active" : "Inactive"}`}
      >
        <div className="flex flex-col gap-4 text-[14px]">
          <p className="flex items-center gap-3">
            <UserIcon aria-hidden="true" className="size-4 text-action" />
            <span>
              <span className="font-semibold">{contact ?? "No contact yet"}</span>
              {contact && <span className="text-ink-2"> · Primary contact</span>}
            </span>
          </p>
          {customer.primaryEmail && (
            <p className="flex items-center gap-3">
              <MailIcon aria-hidden="true" className="size-4 text-action" />
              <a href={`mailto:${customer.primaryEmail}`} className="inline-flex min-h-11 items-center hover:underline lg:min-h-0">
                {customer.primaryEmail}
              </a>
            </p>
          )}
          {customer.primaryPhone && (
            <p className="flex items-center gap-3">
              <PhoneIcon aria-hidden="true" className="size-4 text-action" />
              <a href={`tel:${customer.primaryPhone}`} className="inline-flex min-h-11 items-center hover:underline lg:min-h-0">
                {customer.primaryPhone}
              </a>
            </p>
          )}
          {customer.agreementNumbers.length > 0 && <p className="font-mono text-[12px] text-ink-2">{customer.agreementNumbers.join(" · ")}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {canEdit && customer.primaryContactId && <LinkButton href={`/contacts/${customer.primaryContactId}/edit`}>Edit contact</LinkButton>}
            <Link href={`/customers/${customer.id}`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-control bg-action px-4 text-[13px] font-semibold whitespace-nowrap text-surface shadow-md shadow-action/20 transition-colors hover:bg-action-hover lg:h-[38px]">
              Open customer
            </Link>
          </div>
        </div>
      </Modal>
    </OpenContext.Provider>
  );
}
