"use client";

import Link from "next/link";
import { useState } from "react";
import { FileUpIcon, PlusIcon, SearchIcon } from "lucide-react";
import { SITES, UNITS } from "../_components/data";
import { Back, Btn, Chip, Empty, INPUT, LinkBtn, PANEL, PageHead, Section, Table, TD, TH, itemText, LINK } from "../_components/kit";
import { FormCard, Tabs, TextField, required, useFormCheck, useToast } from "../_components/kit-client";
import { NewAgreementButton } from "../_components/new-agreement";
import { screenHref } from "../_components/shell-parts";

type Filter = "all" | "live" | "none";

/** Every site with the types on it and whether it has a live agreement. */
export function SitesScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [customer, setCustomer] = useState("");
  const rows = SITES.filter((s) => (filter === "all" || (filter === "live") === Boolean(s.live)) && (!customer || s.customer === customer));
  return (
    <div className="flex flex-col gap-6">
      <PageHead title={itemText("Sites & equipment")} sub={itemText("Every site and the equipment on it. A site with no live agreement is where the next one starts.")} actions={<LinkBtn href={screenHref("site-form")} variant="primary"><PlusIcon aria-hidden="true" />Add site</LinkBtn>} />
      <div className={`${PANEL} flex flex-col gap-3 p-3 lg:flex-row lg:items-center`}>
        <Tabs<Filter> label="Filter sites" value={filter} onChange={setFilter} tabs={[{ key: "all", label: "All" }, { key: "live", label: "With a live agreement" }, { key: "none", label: "No live agreement" }]} />
        <label className="lg:ml-auto lg:w-64"><span className="sr-only">Customer</span><select value={customer} onChange={(e) => setCustomer(e.target.value)} className={INPUT}><option value="">All customers</option>{[...new Set(SITES.map((s) => s.customer))].map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      {rows.length === 0 ? <Empty title="No sites match" text="Change the filter, or add a site." /> : (
        <Section flush>
          <div className="hidden md:block"><Table head={["Site", "Customer", itemText("Equipment"), "Agreement"]}>{rows.map((s) => <tr key={s.id} className="hover:bg-ground/70"><td className={TD}><Link href={screenHref("site")} className={LINK}>{s.name}</Link><p className="text-[12px] text-ink-2">{s.address}</p></td><td className={TD}>{s.customer}</td><td className={`${TD} text-ink-nav`}>{s.units} units<p className="text-[12px] text-ink-2">{s.types}</p></td><td className={TD}>{s.live ? <Chip tone="good">{s.live}</Chip> : <NewAgreementButton label="Start one" variant="secondary" className="h-9 lg:h-8" />}</td></tr>)}</Table></div>
          <ul className="divide-y divide-hairline md:hidden">{rows.map((s) => <li key={s.id}><Link href={screenHref("site")} className="flex min-h-11 flex-col gap-1 px-4 py-3.5"><span className="text-[15px] font-semibold">{s.name}</span><span className="text-[12px] text-ink-2">{s.customer} · {s.units} units</span>{s.live ? <Chip tone="good">{s.live}</Chip> : <Chip>No live agreement</Chip>}</Link></li>)}</ul>
        </Section>
      )}
    </div>
  );
}

/** One site's register: every unit on it, searchable, with the ways to add more. */
export function SiteScreen() {
  const [query, setQuery] = useState("");
  const rows = UNITS.filter((u) => !query.trim() || `${u.type} ${u.unit} ${u.model}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-6">
      <Back href={screenHref("sites")}>{itemText("Sites & equipment")}</Back>
      <PageHead title="Harbour Point Tower" badge={<Chip tone="good">AG-1042</Chip>} sub="1200 Waterfront Rd, Vancouver · Northgate Properties" actions={<><LinkBtn href={screenHref("site-form")}>Edit site</LinkBtn><LinkBtn href={screenHref("site-import")}><FileUpIcon aria-hidden="true" />{itemText("Import equipment list")}</LinkBtn><LinkBtn href={screenHref("asset-form")} variant="primary"><PlusIcon aria-hidden="true" />{itemText("Add equipment")}</LinkBtn></>} />
      <Section flush title="Register" sub="14 units" action={<label className="relative block w-56"><span className="sr-only">{itemText("Search equipment")}</span><SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search units" className={`${INPUT} pl-9`} /></label>}>
        {rows.length === 0 ? <div className="p-5"><Empty title="No unit matches" text="Try a model or a unit number." /></div> : (
          <div className="relative overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[14px]"><thead className="border-b border-hairline bg-ground/70"><tr>{["Type", "Unit", "Model", "Location", "Source", ""].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead><tbody className="divide-y divide-hairline">{rows.map((u) => <tr key={u.id}><td className={TD}>{u.type}</td><td className={`${TD} font-semibold`}>{u.unit}</td><td className={`${TD} text-ink-nav`}>{u.model}</td><td className={`${TD} text-ink-2`}>{u.location}</td><td className={TD}><Chip tone={u.source === "Imported" ? "info" : "neutral"}>{u.source}</Chip></td><td className={TD}><LinkBtn href={screenHref("asset-form")} variant="ghost">Edit</LinkBtn></td></tr>)}</tbody></table></div>
        )}
      </Section>
    </div>
  );
}

/** New and edit site. */
export function SiteFormScreen() {
  const toast = useToast();
  const form = useFormCheck({ name: [required("the site's name")], address: [required("the site's address")] }, () => toast.show("Site saved"));
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Back href={screenHref("sites")}>{itemText("Sites & equipment")}</Back>
      <PageHead title="Add site" sub="For Northgate Properties." />
      <FormCard onSubmit={form.handleSubmit} submit="Save site" cancelHref={screenHref("sites")}>
        <TextField name="name" label="Site name" errors={form.errors} placeholder="Harbour Point Tower" className="sm:col-span-2" />
        <TextField name="address" label="Address" errors={form.errors} className="sm:col-span-2" />
        <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-[13px] font-medium">Site contact</span><select className={INPUT}><option>Priya Anand</option><option>Luis Moreno</option></select></label>
      </FormCard>
      {toast.node}
    </div>
  );
}

/** Add or edit one unit by hand. */
export function AssetFormScreen() {
  const toast = useToast();
  const form = useFormCheck({ unit: [required("a unit number")] }, () => toast.show("Unit saved"));
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Back href={screenHref("site")}>Harbour Point Tower</Back>
      <PageHead title={itemText("Add equipment")} sub="One unit at a time. To bring in a list, import it instead." />
      <FormCard onSubmit={form.handleSubmit} submit="Save unit" cancelHref={screenHref("site")}>
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Type</span><select className={INPUT}><option>Rooftop unit</option><option>Boiler</option><option>Exhaust fan</option><option>Backflow preventer</option></select></label>
        <TextField name="unit" label="Unit number" errors={form.errors} placeholder="RTU-4" />
        <TextField name="model" label="Make and model" errors={form.errors} />
        <TextField name="location" label="Location" errors={form.errors} placeholder="Roof, north" />
      </FormCard>
      {toast.node}
    </div>
  );
}

/** Import a list into one site: pick a file, see it read, then review the rows. */
export function SiteImportScreen() {
  const [phase, setPhase] = useState<"pick" | "reading" | "done">("pick");
  const [name, setName] = useState("");
  function read(file?: File) {
    if (!file) return;
    setName(file.name);
    setPhase("reading");
    setTimeout(() => setPhase("done"), 1400);
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Back href={screenHref("site")}>Harbour Point Tower</Back>
      <PageHead title={itemText("Import equipment list")} sub="Excel, CSV, Word or PDF. We read the rows and match each to a type; you review before anything is saved." />
      <Section>
        {phase === "pick" && <label className="flex cursor-pointer flex-col items-center gap-2 rounded-panel border border-dashed border-line-strong bg-ground/60 px-4 py-14 text-center hover:border-action hover:bg-action-tint"><FileUpIcon aria-hidden="true" className="size-7 text-action" /><span className="text-[15px] font-semibold">Drop a file here, or choose one</span><span className="text-[12px] text-ink-2">Up to 10 MB</span><input type="file" accept=".xlsx,.csv,.docx,.pdf" className="sr-only" onChange={(e) => read(e.target.files?.[0])} /></label>}
        {phase === "reading" && <div role="status" className="flex flex-col items-center gap-3 py-14 text-center"><span className="bone size-3 rounded-full bg-action" /><p className="font-semibold">Reading {name}…</p><p className="text-[12px] text-ink-2">Matching rows to types</p></div>}
        {phase === "done" && <div className="flex flex-col gap-4"><p className="rounded-control bg-pill-completed px-4 py-3 text-[14px] font-semibold text-pill-completed-ink">{name}: 34 of 38 rows recognized.</p><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Btn onClick={() => setPhase("pick")}>Choose another file</Btn><LinkBtn href={screenHref("import-job")} variant="primary">Review the rows</LinkBtn></div></div>}
      </Section>
    </div>
  );
}
