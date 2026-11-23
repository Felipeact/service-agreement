"use client";

import { useState } from "react";
import { CheckIcon, CreditCardIcon, ImageIcon } from "lucide-react";
import { COMPANY, INVOICES, MEMBERS, PLANS } from "../_components/data";
import { Btn, Chip, Field, INPUT, PageHead, Section, Table, TD } from "../_components/kit";
import { FormCard, Modal, Tabs, TextField, email, phone, required, useFormCheck, useToast } from "../_components/kit-client";

type SettingsTab = "company" | "terms" | "renewal";
const ACCENTS = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c"];

/** Company, default terms and renewal settings, one section at a time. The accent colour is what the customer sees on every page and email. */
export function SettingsScreen() {
  const [tab, setTab] = useState<SettingsTab>("company");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const toast = useToast();
  const form = useFormCheck({ legal: [required("the legal name")], phone: [phone], singular: [required("the singular word")], plural: [required("the plural word")] }, () => toast.show("Settings saved"));
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHead title="Settings" sub="Your company, the defaults new agreements start from, and how renewals work." />
      <Tabs<SettingsTab> label="Settings section" value={tab} onChange={setTab} tabs={[{ key: "company", label: "Company" }, { key: "terms", label: "Default terms" }, { key: "renewal", label: "Renewal" }]} />
      <FormCard onSubmit={form.handleSubmit} submit="Save changes">
        {tab === "company" && (
          <>
            <div className="flex items-center gap-4 sm:col-span-2"><span className="flex size-16 items-center justify-center rounded-card border border-dashed border-line-strong bg-ground text-ink-2"><ImageIcon aria-hidden="true" className="size-6" /></span><div><label className="inline-flex h-11 cursor-pointer items-center rounded-control border border-hairline bg-surface px-4 text-[13px] font-semibold hover:border-line-strong lg:h-[38px]">Choose logo<input type="file" accept="image/*" className="sr-only" /></label><p className="mt-1 text-[12px] text-ink-2">Shown on your agreements, PDFs and emails. PNG or SVG.</p></div></div>
            <TextField name="legal" label="Legal name" errors={form.errors} defaultValue="Blue Heron Mechanical Ltd." />
            <TextField name="phone" label="Phone" errors={form.errors} defaultValue="604 555 0100" />
            <TextField name="address" label="Address" errors={form.errors} defaultValue="300 Industrial Way, Burnaby BC" className="sm:col-span-2" />
            <TextField name="singular" label="Item, singular" errors={form.errors} defaultValue="equipment" hint="What you call one thing you service." />
            <TextField name="plural" label="Item, plural" errors={form.errors} defaultValue="equipment" />
            <fieldset className="sm:col-span-2"><legend className="mb-2 text-[13px] font-medium">Accent colour</legend><div className="flex flex-wrap gap-2">{ACCENTS.map((c) => <label key={c} className="relative"><input type="radio" name="accent" value={c} checked={accent === c} onChange={() => setAccent(c)} className="peer sr-only" /><span className="flex size-11 items-center justify-center rounded-full ring-2 ring-transparent peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action" style={{ background: c }}>{accent === c && <CheckIcon aria-hidden="true" className="size-5 text-surface" />}</span><span className="sr-only">{c}</span></label>)}</div><p className="mt-2 text-[12px] text-ink-2">Customers see this colour on the review page, signing page and PDF.</p></fieldset>
          </>
        )}
        {tab === "terms" && (
          <>
            <TextField name="discount" label="Repair discount (%)" errors={form.errors} defaultValue="10" />
            <TextField name="cpi" label="CPI cap (%)" errors={form.errors} defaultValue="4" />
            <TextField name="cancel" label="Cancellation notice (days)" errors={form.errors} defaultValue="60" />
            <TextField name="payment" label="Payment terms (days)" errors={form.errors} defaultValue="30" />
            <TextField name="valid" label="Proposals valid for (days)" errors={form.errors} defaultValue="30" />
            <Field label="Governing province"><select className={INPUT} defaultValue="BC"><option value="BC">British Columbia</option><option value="AB">Alberta</option><option value="ON">Ontario</option></select></Field>
            <TextField name="tax" label="Tax note" errors={form.errors} defaultValue="GST applies. PST exempt for service." className="sm:col-span-2" />
          </>
        )}
        {tab === "renewal" && (
          <>
            <TextField name="term" label="Default term (months)" errors={form.errors} defaultValue="12" />
            <TextField name="notice" label="Renewal notice (days)" errors={form.errors} defaultValue="90" />
            <TextField name="threshold" label="CPI renegotiation threshold (%)" errors={form.errors} defaultValue="5" hint="Above this, renewal is renegotiated, not automatic." />
            <TextField name="cpiRenew" label="CPI for renewals" errors={form.errors} defaultValue="3.2" />
          </>
        )}
      </FormCard>
      {toast.node}
    </div>
  );
}

/** Plan, usage, payment method and invoices. Changing a plan or cancelling asks first and says what happens next. */
export function BillingScreen() {
  const [plan, setPlan] = useState("team");
  const [switchTo, setSwitchTo] = useState<(typeof PLANS)[number] | null>(null);
  const [cancel, setCancel] = useState(false);
  const toast = useToast();
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHead title="Billing" sub="Your plan, what you have used, and your invoices." />
      <Section title="Plan">
        <ul className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const current = p.key === plan;
            return (
              <li key={p.key} className={`flex flex-col gap-3 rounded-card border p-4 ${current ? "border-action bg-action-tint ring-1 ring-action/30" : "border-hairline"}`}>
                <div className="flex items-center gap-2"><h3 className="mr-auto text-[16px] font-bold">{p.name}</h3>{current && <Chip tone="info">Current</Chip>}</div>
                <p className="text-[26px] font-bold tracking-tight">${p.price}<span className="text-[13px] font-medium text-ink-2"> /month CAD</span></p>
                <p className="text-[13px] text-ink-nav">{p.blurb}</p>
                <p className="text-[12px] text-ink-2">{p.limit} active agreements · {p.seats} seats</p>
                <Btn variant={current ? "secondary" : "primary"} disabled={current} onClick={() => setSwitchTo(p)} className="mt-auto">{current ? "Your plan" : `Switch to ${p.name}`}</Btn>
              </li>
            );
          })}
        </ul>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Usage"><div className="flex flex-col gap-4 text-[13px]">{[["Active agreements", 12, 50], ["Seats", 4, 6]].map(([k, used, max]) => <div key={k as string}><div className="flex justify-between"><span className="font-medium">{k}</span><span className="font-semibold">{used} / {max}</span></div><div role="progressbar" aria-label={k as string} aria-valuemin={0} aria-valuemax={max as number} aria-valuenow={used as number} className="mt-1.5 h-2 overflow-hidden rounded-full bg-board"><div className="h-full rounded-full bg-action" style={{ width: `${((used as number) / (max as number)) * 100}%` }} /></div></div>)}</div></Section>
        <Section title="Payment method" action={<Btn onClick={() => toast.show("Opening secure card form")}>Update</Btn>}><p className="flex items-center gap-3 text-[14px]"><CreditCardIcon aria-hidden="true" className="size-5 text-action" /><span><span className="font-semibold">Visa ending 4242</span><span className="block text-[12px] text-ink-2">Expires 08/28</span></span></p></Section>
      </div>
      <Section flush title="Invoices"><Table head={["Date", "Amount", "Status", ""]}>{INVOICES.map((i) => <tr key={i.id}><td className={TD}>{i.date}</td><td className={`${TD} font-semibold`}>{i.amount}</td><td className={TD}><Chip tone="good">{i.status}</Chip></td><td className={TD}><Btn variant="ghost" onClick={() => toast.show(`Downloaded invoice ${i.date}`)}>Download</Btn></td></tr>)}</Table></Section>
      <div className="flex justify-end"><Btn variant="danger" onClick={() => setCancel(true)}>Cancel subscription</Btn></div>
      <Modal open={Boolean(switchTo)} onClose={() => setSwitchTo(null)} title={`Switch to ${switchTo?.name}?`} sub={switchTo ? `$${switchTo.price}/month CAD, billed from your next invoice. You keep everything you have.` : ""}><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Btn onClick={() => setSwitchTo(null)}>Keep my plan</Btn><Btn variant="primary" onClick={() => { if (switchTo) { setPlan(switchTo.key); toast.show(`Switched to ${switchTo.name}`); } setSwitchTo(null); }}>Switch plan</Btn></div></Modal>
      <Modal open={cancel} onClose={() => setCancel(false)} title="Cancel your subscription?" sub="Your workspace turns read-only at the end of this period. Nothing is deleted."><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Btn onClick={() => setCancel(false)}>Keep subscription</Btn><Btn variant="danger" onClick={() => { setCancel(false); toast.show("Subscription will end on Dec 1"); }}>Cancel subscription</Btn></div></Modal>
      {toast.node}
    </div>
  );
}

const ROLES = ["Owner", "Admin", "Estimator", "Viewer"];

/** Who is in the workspace: invite by email, change a role, remove someone, resend or revoke an invitation. */
export function MembersScreen() {
  const [people, setPeople] = useState(MEMBERS.map((m) => ({ ...m })));
  const [pending, setPending] = useState([{ email: "alex@blueheron.example", role: "Estimator" }]);
  const [remove, setRemove] = useState<string | null>(null);
  const toast = useToast();
  const form = useFormCheck({ email: [required("an email address"), email] }, (values) => {
    setPending((list) => [{ email: values.email, role: values.role || "Estimator" }, ...list]);
    toast.show(`Invitation sent to ${values.email}`);
  });
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHead title="Members" sub={`${people.length} of 6 seats used on the ${COMPANY.plan} plan.`} />
      <Section title="Invite someone" sub="They get an email with a link to join.">
        <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <TextField name="email" label="Email" type="email" errors={form.errors} className="sm:flex-1" />
          <Field label="Role" className="sm:w-44"><select name="role" defaultValue="Estimator" className={INPUT}>{ROLES.slice(1).map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Btn type="submit" variant="primary" className="sm:mt-6">Send invitation</Btn>
        </form>
      </Section>
      <Section flush title={`People in ${COMPANY.name}`}>
        <ul className="divide-y divide-hairline">
          {people.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-full bg-action-tint text-[12px] font-bold text-action-press">{m.name.split(" ").map((p) => p[0]).join("")}</span>
              <span className="mr-auto min-w-0 text-[14px]"><span className="block font-semibold">{m.name}</span><span className="text-[12px] text-ink-2">{m.email}</span></span>
              {m.role === "Owner" ? <Chip tone="info">Owner</Chip> : (
                <>
                  <label><span className="sr-only">Role for {m.name}</span><select value={m.role} onChange={(e) => { setPeople(people.map((p) => (p.id === m.id ? { ...p, role: e.target.value } : p))); toast.show(`${m.name} is now ${e.target.value}`); }} className={`${INPUT} w-36`}>{ROLES.slice(1).map((r) => <option key={r}>{r}</option>)}</select></label>
                  <Btn variant="ghost" onClick={() => setRemove(m.id)} className="text-danger">Remove</Btn>
                </>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section flush title="Pending invitations">
        {pending.length === 0 ? <p className="p-5 text-[13px] text-ink-2">No pending invitations.</p> : <ul className="divide-y divide-hairline">{pending.map((p) => <li key={p.email} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"><span className="mr-auto text-[14px] font-semibold">{p.email}<span className="ml-2 text-[12px] font-normal text-ink-2">{p.role}</span></span><Btn onClick={() => toast.show(`Resent to ${p.email}`)}>Resend</Btn><Btn variant="ghost" className="text-danger" onClick={() => { setPending(pending.filter((x) => x.email !== p.email)); toast.show("Invitation revoked"); }}>Revoke</Btn></li>)}</ul>}
      </Section>
      <Modal open={Boolean(remove)} onClose={() => setRemove(null)} title="Remove this member?" sub="They lose access now. Their work stays in the workspace."><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Btn onClick={() => setRemove(null)}>Cancel</Btn><Btn variant="danger" onClick={() => { setPeople(people.filter((p) => p.id !== remove)); setRemove(null); toast.show("Member removed"); }}>Remove</Btn></div></Modal>
      {toast.node}
    </div>
  );
}

