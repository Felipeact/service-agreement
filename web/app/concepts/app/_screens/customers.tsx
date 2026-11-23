"use client";

import Link from "next/link";
import { useState } from "react";
import { MailIcon, MapPinIcon, PhoneIcon, PlusIcon, SearchIcon } from "lucide-react";
import { CUSTOMERS, DEALS, SITES, money, type Customer } from "../_components/data";
import { Back, Btn, Chip, Empty, INPUT, LinkBtn, PANEL, PageHead, Section, StagePill, Table, TD, LINK } from "../_components/kit";
import { FormCard, Modal, Tabs, TextField, email, phone, required, useFormCheck, useToast } from "../_components/kit-client";
import { screenHref } from "../_components/shell-parts";

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-action-tint font-bold text-action-press ${large ? "size-11 text-[15px]" : "size-9 text-[12px]"}`}>{initials(name)}</span>;
}

/** The customer cards: search, an active filter, and a details sheet over the list so a quick look never loses your place. */
export function CustomersScreen() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [open, setOpen] = useState<Customer | null>(null);
  const needle = query.trim().toLowerCase();
  const rows = CUSTOMERS.filter((c) => (status === "all" || (status === "active") === c.active) && (!needle || `${c.name} ${c.contact}`.toLowerCase().includes(needle)));
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Customers" badge={<Chip tone="info">{CUSTOMERS.filter((c) => c.active).length} active</Chip>} sub="The companies you service, with their sites and agreements." actions={<LinkBtn href={screenHref("customer-form")} variant="primary"><PlusIcon aria-hidden="true" />New customer</LinkBtn>} />
      <div className={`${PANEL} flex flex-col gap-3 p-3 lg:flex-row lg:items-center`}>
        <label className="relative block lg:w-80"><span className="sr-only">Search customers</span><SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers or contacts" className={`${INPUT} pl-9`} /></label>
        <Tabs label="Status" value={status} onChange={setStatus} tabs={[{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }]} />
      </div>
      {rows.length === 0 ? <Empty title="No customers match" text="Try another name, or add the customer." action={<LinkBtn href={screenHref("customer-form")} variant="primary">New customer</LinkBtn>} /> : (
        <ul className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id} className={`${PANEL} flex flex-col transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-lift`}>
              <div className="flex items-start gap-3 p-5 pb-4">
                <Avatar name={c.name} large />
                <Link href={screenHref("customer")} className="inline-flex min-h-11 min-w-0 flex-1 items-center text-[16px] leading-snug font-semibold tracking-tight hover:text-action lg:min-h-0">{c.name}</Link>
                {c.active ? <Chip tone="good">Active</Chip> : <Chip>Inactive</Chip>}
              </div>
              <dl className="grid grid-cols-3 gap-2 border-y border-hairline px-5 py-3 text-center">
                {[["Agreements", c.agreements], ["Sites", c.sites], ["Per year", money(c.value)]].map(([k, v]) => <div key={k}><dd className="text-[16px] font-bold">{v}</dd><dt className="text-[11px] text-ink-2">{k}</dt></div>)}
              </dl>
              <div className="flex items-center justify-between gap-2 px-5 py-3 text-[12px] text-ink-2"><span className="truncate">{c.contact}</span><Btn variant="ghost" onClick={() => setOpen(c)} className="-mr-2 h-11 text-action lg:h-8">View details</Btn></div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name ?? ""} sub={open ? `${open.agreements} agreements · ${open.sites} sites` : ""}>
        {open && (
          <div className="flex flex-col gap-4 text-[14px]">
            <p className="flex items-center gap-3"><MailIcon aria-hidden="true" className="size-4 text-action" />{open.contact}, {open.email}</p>
            <p className="flex items-center gap-3"><PhoneIcon aria-hidden="true" className="size-4 text-action" />{open.phone}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><LinkBtn href={screenHref("customer-form")}>Edit customer</LinkBtn><LinkBtn href={screenHref("customer")} variant="primary">Open customer</LinkBtn></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** One customer: who to talk to, where the work is, and every agreement. */
export function CustomerScreen() {
  const c = CUSTOMERS[0];
  const deals = DEALS.filter((d) => d.customer === c.name);
  const sites = SITES.filter((s) => s.customer === c.name);
  return (
    <div className="flex flex-col gap-6">
      <Back href={screenHref("customers")}>Customers</Back>
      <PageHead title={c.name} badge={<Chip tone="good">Active</Chip>} sub={`${c.agreements} agreements · ${money(c.value)}/yr`} actions={<><LinkBtn href={screenHref("customer-form")}>Edit customer</LinkBtn><LinkBtn href={screenHref("contact-form")}>Add contact</LinkBtn><LinkBtn href={screenHref("site-form")} variant="primary"><PlusIcon aria-hidden="true" />Add site</LinkBtn></>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section flush title="Agreements" action={<LinkBtn href={screenHref("agreements")}>All agreements</LinkBtn>}>
            <Table head={["Agreement", "Stage", "Per year"]}>{deals.map((d) => <tr key={d.id}><td className={TD}><Link href={screenHref("agreement")} className={LINK}>{d.number}</Link><p className="text-[12px] text-ink-2">{d.site}</p></td><td className={TD}><StagePill stage={d.stage} /></td><td className={`${TD} font-semibold`}>{money(d.annual)}</td></tr>)}</Table>
          </Section>
          <Section title="Sites">
            <ul className="grid gap-3 sm:grid-cols-2">{sites.map((s) => <li key={s.id}><Link href={screenHref("site")} className="flex min-h-11 items-start gap-3 rounded-card border border-hairline p-3 hover:border-action hover:bg-action-tint"><MapPinIcon aria-hidden="true" className="mt-0.5 size-4 text-action" /><span className="text-[14px]"><span className="block font-semibold">{s.name}</span><span className="text-[12px] text-ink-2">{s.address} · {s.units} units</span></span></Link></li>)}</ul>
          </Section>
        </div>
        <Section title="Contacts" action={<LinkBtn href={screenHref("contact-form")}>Add</LinkBtn>}>
          <ul className="flex flex-col gap-3">{[["Priya Anand", "Property manager · primary"], ["Luis Moreno", "Building engineer"]].map(([n, r]) => <li key={n} className="flex items-center gap-3"><Avatar name={n} /><span className="min-w-0 flex-1 text-[14px]"><span className="block font-semibold">{n}</span><span className="text-[12px] text-ink-2">{r}</span></span><LinkBtn href={screenHref("contact-form")} variant="ghost">Edit</LinkBtn></li>)}</ul>
        </Section>
      </div>
    </div>
  );
}

/** New and edit customer, on one form. A phone number with fewer than ten digits is refused with the fix in the message. */
export function CustomerFormScreen() {
  const toast = useToast();
  const form = useFormCheck({ name: [required("the customer's name")], billing: [email], phone: [phone] }, () => toast.show("Customer saved"));
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Back href={screenHref("customers")}>Customers</Back>
      <PageHead title="Edit customer" sub="Its sites and agreements stay as they are." />
      <FormCard onSubmit={form.handleSubmit} submit="Save changes" cancelHref={screenHref("customers")}>
        <TextField name="name" label="Customer name" errors={form.errors} defaultValue="Northgate Properties" className="sm:col-span-2" />
        <TextField name="billing" label="Billing email" type="email" errors={form.errors} defaultValue="accounts@northgate.example" hint="Invoices and renewal notices go here." />
        <TextField name="phone" label="Phone" errors={form.errors} defaultValue="604 555" />
        <TextField name="address" label="Address" errors={form.errors} defaultValue="1200 Waterfront Rd, Vancouver" className="sm:col-span-2" />
        <label className="flex items-center gap-3 text-[14px] sm:col-span-2"><input type="checkbox" defaultChecked className="size-4 accent-[var(--color-action)]" />Active customer</label>
      </FormCard>
      {toast.node}
    </div>
  );
}

/** New and edit contact. */
export function ContactFormScreen() {
  const toast = useToast();
  const form = useFormCheck({ name: [required("the contact's name")], email: [email], phone: [phone] }, () => toast.show("Contact saved"));
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Back href={screenHref("customer")}>Northgate Properties</Back>
      <PageHead title="Add contact" sub="Who we write to, and who signs." />
      <FormCard onSubmit={form.handleSubmit} submit="Save contact" cancelHref={screenHref("customer")}>
        <TextField name="name" label="Full name" errors={form.errors} />
        <TextField name="role" label="Role" errors={form.errors} placeholder="Property manager" />
        <TextField name="email" label="Email" type="email" errors={form.errors} />
        <TextField name="phone" label="Phone" errors={form.errors} hint="Ten digits." />
        <label className="flex items-center gap-3 text-[14px] sm:col-span-2"><input type="checkbox" className="size-4 accent-[var(--color-action)]" />Primary contact, receives the agreement link</label>
      </FormCard>
      {toast.node}
    </div>
  );
}
