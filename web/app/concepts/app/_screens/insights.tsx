"use client";

import Link from "next/link";
import { useState } from "react";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { CUSTOMERS, DEALS, EXPIRING, SITES, UNITS, money } from "../_components/data";
import { Btn, Chip, Empty, Field, INPUT, PANEL, PageHead, Section, Stat, StagePill, itemText, LINK } from "../_components/kit";
import { useToast } from "../_components/kit-client";
import { screenHref } from "../_components/shell-parts";

const FUNNEL = [["Created", 24, "bg-stage-in-progress"], ["Sent", 19, "bg-stage-sent"], ["Accepted", 13, "bg-stage-accepted"], ["Signed", 10, "bg-stage-completed"]] as const;
const BY_CUSTOMER = [["Ridgeline Realty", 31500], ["Northgate Properties", 20680], ["Pine Ridge Holdings", 18800], ["Westside District", 16020], ["Cedar Health Group", 9640]] as const;
const BY_TYPE = [["Rooftop unit", 41200], ["Boiler", 22800], ["Exhaust fan", 9400], ["Backflow preventer", 6900]] as const;

function Bars({ rows, max }: { rows: readonly (readonly [string, number])[]; max: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(([label, value]) => (
        <li key={label} className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate font-medium">{label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-board"><span className="block h-full rounded-full bg-action" style={{ width: `${(value / max) * 100}%` }} /></span>
          <span className="font-semibold">{money(value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Reports for a date range: the headline, the funnel, where deals stall, and revenue by customer and by type. Every block exports to CSV. */
export function ReportsScreen() {
  const [error, setError] = useState<string>();
  const [range, setRange] = useState({ from: "2026-06-16", to: "2027-06-15" });
  const toast = useToast();
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Reports" sub={`${range.from} to ${range.to}`} />
      <form noValidate onSubmit={(e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as typeof range; if (d.from > d.to) setError("The start date is after the end date."); else { setError(undefined); setRange(d); toast.show("Range applied"); } }} className={`${PANEL} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}>
        <Field label="From" className="sm:w-44"><input name="from" type="date" defaultValue={range.from} className={INPUT} /></Field>
        <Field label="To" className="sm:w-44" error={error}><input name="to" type="date" defaultValue={range.to} aria-invalid={error ? true : undefined} className={INPUT} /></Field>
        <Btn type="submit" variant="primary">Apply range</Btn>
        <Btn onClick={() => { setRange({ from: "2026-06-16", to: "2027-06-15" }); setError(undefined); }}>Last 12 months</Btn>
      </form>
      <dl className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Recurring revenue" value={money(95540)} note="a year, agreements in term" />
        <Stat label="Pipeline" value={money(49940)} note="open agreements" />
        <Stat label="Win rate" value="77%" note="10 of 13 decided" />
        <Stat label="Avg. days to sign" value="11" note="from sent to signed" />
      </dl>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Funnel" sub="Where agreements drop off.">
          <ul className="flex flex-col gap-3">{FUNNEL.map(([label, n, color]) => <li key={label} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-3 text-[13px]"><span className="font-medium">{label}</span><span className="h-6 overflow-hidden rounded-control bg-board"><span className={`block h-full rounded-control ${color}`} style={{ width: `${(n / 24) * 100}%` }} /></span><span className="text-right font-semibold">{n}</span></li>)}</ul>
          <p className="mt-3 border-t border-hairline pt-3 text-[12px] text-ink-2">42% dropped off between created and signed.</p>
        </Section>
        <Section title="Speed and stuck deals" sub="Open longer than the follow-up time.">
          <ul className="divide-y divide-hairline text-[14px]">{DEALS.filter((d) => d.attention).map((d) => <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"><Link href={screenHref("agreement")} className={LINK}>{d.number}</Link><span className="text-ink-nav">{d.site}</span><span className="ml-auto"><Chip tone="attention">{d.days} days</Chip></span></li>)}</ul>
        </Section>
        <Section title="Lost deals" sub="Refused and withdrawn."><ul className="divide-y divide-hairline text-[14px]">{DEALS.filter((d) => d.stage === "refused").map((d) => <li key={d.id} className="flex items-center gap-3 py-2.5"><span className="font-semibold">{d.number}</span><span className="text-ink-nav">{d.site}</span><span className="ml-auto font-semibold">{money(d.annual)}</span></li>)}<li className="py-2.5 text-[13px] text-ink-2">Withdrawn · 2</li></ul></Section>
        <Section title="Renewals due" action={<Btn onClick={() => toast.show("Downloaded renewals.csv")}><DownloadIcon aria-hidden="true" />Download CSV</Btn>}><ul className="divide-y divide-hairline text-[14px]">{EXPIRING.map((e) => <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2.5"><Link href={screenHref("agreement")} className={LINK}>{e.number}</Link><span>{e.customer}</span><span className="text-ink-2">ends {e.ends}</span><span className="ml-auto font-semibold">{money(e.annual)}/yr</span></li>)}</ul></Section>
        <Section title="Revenue by customer" action={<Btn onClick={() => toast.show("Downloaded revenue-by-customer.csv")}><DownloadIcon aria-hidden="true" />Download CSV</Btn>}><Bars rows={BY_CUSTOMER} max={31500} /></Section>
        <Section title="Revenue by type" sub="Each line's value split equally over the types it covers." action={<Btn onClick={() => toast.show("Downloaded revenue-by-type.csv")}><DownloadIcon aria-hidden="true" />Download CSV</Btn>}><Bars rows={BY_TYPE} max={41200} /></Section>
      </div>
      {toast.node}
    </div>
  );
}

/** Search across customers, sites, units and agreements. */
export function SearchScreen({ q = "" }: { q?: string }) {
  const [query, setQuery] = useState(q);
  const needle = query.trim().toLowerCase();
  const has = (...parts: string[]) => parts.join(" ").toLowerCase().includes(needle);
  const customers = needle ? CUSTOMERS.filter((c) => has(c.name, c.contact)) : [];
  const sites = needle ? SITES.filter((s) => has(s.name, s.address, s.customer)) : [];
  const units = needle ? UNITS.filter((u) => has(u.type, u.unit, u.model)) : [];
  const deals = needle ? DEALS.filter((d) => has(d.number, d.site, d.customer)) : [];
  const total = customers.length + sites.length + units.length + deals.length;
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Search" sub={needle ? `${total} results for “${query.trim()}”` : "Customers, sites, units and agreements, in one box."} />
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative max-w-2xl"><span className="sr-only">Search</span><SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-2" /><input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “harbour”, “boiler” or “AG-1038”" className={`${INPUT} h-12 pl-11 text-[15px] shadow-float`} /></form>
      {!needle && <Empty title="Start typing" text="Results appear as you type, grouped by what they are." />}
      {needle && total === 0 && <Empty title="No results" text="Check the spelling, or search by an agreement number." />}
      {customers.length > 0 && <Section title="Customers" action={<Chip>{customers.length}</Chip>}><ul className="divide-y divide-hairline">{customers.map((c) => <li key={c.id}><Link href={screenHref("customer")} className="flex min-h-11 items-center gap-3 py-2 hover:text-action"><span className="font-semibold">{c.name}</span><span className="ml-auto text-[12px] text-ink-2">{c.contact}</span></Link></li>)}</ul></Section>}
      {sites.length > 0 && <Section title="Sites" action={<Chip>{sites.length}</Chip>}><ul className="divide-y divide-hairline">{sites.map((s) => <li key={s.id}><Link href={screenHref("site")} className="flex min-h-11 items-center gap-3 py-2 hover:text-action"><span className="font-semibold">{s.name}</span><span className="ml-auto text-[12px] text-ink-2">{s.address}</span></Link></li>)}</ul></Section>}
      {units.length > 0 && <Section title={itemText("Equipment")} action={<Chip>{units.length}</Chip>}><ul className="divide-y divide-hairline">{units.map((u) => <li key={u.id}><Link href={screenHref("site")} className="flex min-h-11 items-center gap-3 py-2 hover:text-action"><span className="font-semibold">{u.type} {u.unit}</span><span className="ml-auto text-[12px] text-ink-2">{u.model}</span></Link></li>)}</ul></Section>}
      {deals.length > 0 && <Section title="Agreements" action={<Chip>{deals.length}</Chip>}><ul className="divide-y divide-hairline">{deals.map((d) => <li key={d.id}><Link href={screenHref("agreement")} className="flex min-h-11 flex-wrap items-center gap-x-3 py-2 hover:text-action"><span className="font-semibold">{d.number}</span><span>{d.site}</span><span className="ml-auto"><StagePill stage={d.stage} /></span></Link></li>)}</ul></Section>}
    </div>
  );
}
