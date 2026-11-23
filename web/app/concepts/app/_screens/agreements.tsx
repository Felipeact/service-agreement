"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, SearchIcon, SendIcon } from "lucide-react";
import { ACTIVITY, DEALS, MONTHS, SCHEDULE, SERVICE_LINES, UNITS, money, type StageKey } from "../_components/data";
import { Back, Btn, Chip, Empty, INPUT, LinkBtn, PANEL, PageHead, Section, Stat, StagePill, Table, TD, itemText, LINK } from "../_components/kit";
import { Modal, Tabs, useToast } from "../_components/kit-client";
import { NewAgreementButton } from "../_components/new-agreement";
import { screenHref } from "../_components/shell-parts";

type Filter = "all" | StageKey;

/** All agreements in every status, with the stage tabs, a search and a CSV export. A card list replaces the table on a phone. */
export function AgreementsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const toast = useToast();
  const needle = query.trim().toLowerCase();
  const rows = DEALS.filter((deal) => (filter === "all" || deal.stage === filter) && (!needle || `${deal.site} ${deal.customer} ${deal.number}`.toLowerCase().includes(needle)));
  const count = (stage: StageKey) => DEALS.filter((deal) => deal.stage === stage).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Agreements" badge={<Chip tone="info">{DEALS.length} total</Chip>} sub="Every agreement, whatever its status." actions={<><Btn onClick={() => toast.show("Exported agreements-2026-11-22.csv")}><DownloadIcon aria-hidden="true" />Export CSV</Btn><NewAgreementButton /></>} />
      <dl className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Active" value="5" note="2 pending reply" />
        <Stat label="Annual value" value={money(95540)} note="ARR across live agreements" />
        <Stat label="Overdue visits" value="0" note="All on schedule" />
        <Stat label="Signed this year" value={money(25200)} note="2 agreements" />
      </dl>
      <Section flush>
        <div className="flex flex-col gap-3 border-b border-hairline p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Filter> label="Filter by status" value={filter} onChange={setFilter} tabs={[{ key: "all", label: "All", count: DEALS.length }, { key: "in_progress", label: "In progress", count: count("in_progress") }, { key: "sent", label: "Sent", count: count("sent") }, { key: "accepted", label: "Accepted", count: count("accepted") }, { key: "completed", label: "Completed", count: count("completed") }, { key: "refused", label: "Refused", count: count("refused") }]} />
          <label className="relative block lg:w-72"><span className="sr-only">Search agreements</span><SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agreements" className={`${INPUT} pl-9`} /></label>
        </div>
        {rows.length === 0 ? <div className="p-6"><Empty title="No agreements match" text="Try another status or clear the search." action={<Btn onClick={() => { setFilter("all"); setQuery(""); }}>Show all</Btn>} /></div> : (
          <>
            <div className="hidden md:block">
              <Table head={["Agreement", "Customer", "Stage", "Per year", "Visits", "Updated"]}>
                {rows.map((deal) => (
                  <tr key={deal.id} className="hover:bg-ground/70">
                    <td className={TD}><Link href={screenHref("agreement")} className={LINK}>{deal.number}</Link><p className="text-[12px] text-ink-2">{deal.site}</p></td>
                    <td className={TD}>{deal.customer}</td>
                    <td className={TD}><StagePill stage={deal.stage} /></td>
                    <td className={`${TD} font-semibold`}>{money(deal.annual)}</td>
                    <td className={`${TD} text-ink-nav`}>{deal.visits}</td>
                    <td className={`${TD} text-ink-2`}>{deal.updated}</td>
                  </tr>
                ))}
              </Table>
            </div>
            <ul className="divide-y divide-hairline md:hidden">
              {rows.map((deal) => (
                <li key={deal.id}><Link href={screenHref("agreement")} className="flex min-h-11 flex-col gap-2 px-4 py-3.5">
                  <span className="flex items-start justify-between gap-3"><span><span className="block text-[15px] font-semibold">{deal.site}</span><span className="text-[12px] text-ink-2">{deal.number} · {deal.customer}</span></span><span className="text-[15px] font-semibold">{money(deal.annual)}</span></span>
                  <span className="flex items-center justify-between"><StagePill stage={deal.stage} /><span className="text-[12px] text-ink-2">{deal.updated}</span></span>
                </Link></li>
              ))}
            </ul>
          </>
        )}
      </Section>
      {toast.node}
    </div>
  );
}

const STEPS: { key: StageKey; label: string }[] = [{ key: "in_progress", label: "In progress" }, { key: "sent", label: "Sent" }, { key: "accepted", label: "Accepted" }, { key: "completed", label: "Signed" }];

/** One agreement: where it stands, what the customer will see, and everything on it. Mutating controls confirm with a toast in the same words as their button. */
export function AgreementScreen() {
  const [stage, setStage] = useState<StageKey>("in_progress");
  const [pdf, setPdf] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const toast = useToast();
  const reached = STEPS.findIndex((step) => step.key === stage);
  const annual = SERVICE_LINES.reduce((sum, line) => sum + line.per * (line.visits === 4 ? 1 : 1), 0);
  return (
    <div className="flex flex-col gap-6">
      <Back href={screenHref("agreements")}>Agreements</Back>
      <PageHead title="AG-1042" badge={<StagePill stage={stage} />} sub={<>Harbour Point Tower · <Link href={screenHref("customer")} className={LINK}>Northgate Properties</Link> · Template: Standard agreement</>}
        actions={<><Btn onClick={() => setPdf(true)}>Preview PDF</Btn><Btn onClick={() => toast.show("Downloaded AG-1042.pdf")}><DownloadIcon aria-hidden="true" />Download PDF</Btn>{stage === "in_progress" ? <Btn variant="primary" onClick={() => setConfirm(true)}><SendIcon aria-hidden="true" />Send to customer</Btn> : <Btn variant="primary" onClick={() => { setStage("accepted"); toast.show("Marked as accepted"); }}>Mark accepted</Btn>}</>} />

      <ol aria-label="Progress" className={`${PANEL} grid grid-cols-4 gap-1 p-3`}>
        {STEPS.map((step, index) => (
          <li key={step.key} aria-current={index === reached ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
            <span className={`flex size-7 items-center justify-center rounded-full text-[12px] font-bold ${index <= reached ? "bg-action text-surface" : "bg-board text-ink-2"}`}>{index < reached ? <CheckIcon aria-hidden="true" className="size-4" /> : index + 1}</span>
            <span className={`text-[12px] font-semibold ${index <= reached ? "text-ink" : "text-ink-2"}`}>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Term" action={<Btn variant="ghost">Edit term</Btn>}><p className="text-[14px]">Dec 1, 2026 – Nov 30, 2027 · 12 months · <span className="text-ink-2">Renews automatically with notice 90 days before the end</span></p></Section>
          <Section flush title="Service lines" action={<Btn>Add line</Btn>}>
            <Table head={["Description", "Visits per year", "Per visit", "Per year"]}>
              {SERVICE_LINES.map((line) => (
                <tr key={line.name}><td className={TD}><p className="font-semibold">{line.name}</p><p className="text-[12px] text-ink-2">{line.detail} · {line.types}</p></td><td className={TD}>{line.visits}</td><td className={TD}>{money(line.per / line.visits)}</td><td className={`${TD} font-semibold`}>{money(line.per)}</td></tr>
              ))}
              <tr className="bg-ground/70"><td className={`${TD} font-semibold`} colSpan={3}>Total per year <span className="font-normal text-ink-2">before tax</span></td><td className={`${TD} text-[16px] font-bold`}>{money(annual)}</td></tr>
            </Table>
          </Section>
          <Section title="Visit schedule" sub="Each line holds its own months.">
            <div className="relative overflow-x-auto"><div className="grid min-w-[560px] grid-cols-[minmax(9rem,1.4fr)_repeat(12,minmax(0,1fr))] items-center gap-x-1 gap-y-2">
              <span aria-hidden="true" />{MONTHS.map((month, i) => <span key={i} className="text-center text-[11px] font-semibold text-ink-2">{month}</span>)}
              {SCHEDULE.map((row) => (<Fragment key={row.name}><span className="text-[13px] font-medium">{row.name}</span>{MONTHS.map((_, i) => <span key={i} className={`h-7 rounded-[6px] ${row.months.includes(i) ? "sa-pop bg-action" : "bg-board"}`}><span className="sr-only">{row.months.includes(i) ? `Visit in month ${i + 1}` : ""}</span></span>)}</Fragment>))}
            </div></div>
          </Section>
          <Section title="Service included" sub="Written from the types on site.">
            <div className="grid gap-4 sm:grid-cols-2">{[["Rooftop units", ["Replace filters", "Check belts and bearings", "Clean condensate drain"]], ["Boilers", ["Inspect burner and flame", "Test safety controls"]]].map(([type, tasks]) => (
              <div key={type as string}><p className="mb-1.5 text-[13px] font-semibold">{type as string}</p><ul className="flex flex-col gap-1">{(tasks as string[]).map((task) => <li key={task} className="flex items-center gap-2 text-[13px] text-ink-nav"><CheckIcon aria-hidden="true" className="size-4 text-stage-completed" />{task}</li>)}</ul></div>
            ))}</div>
          </Section>
          <Section flush title={itemText("Equipment")} sub="14 units on this site">
            <Table head={["Type", "Unit", "Model", "Location"]}>{UNITS.map((u) => <tr key={u.id}><td className={TD}>{u.type}</td><td className={`${TD} font-semibold`}>{u.unit}</td><td className={`${TD} text-ink-nav`}>{u.model}</td><td className={`${TD} text-ink-2`}>{u.location}</td></tr>)}</Table>
          </Section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Section title="Customer link" sub="What the customer opens. No account needed.">
            <div className="flex items-center gap-2 rounded-control border border-hairline bg-ground px-3 py-2 text-[12px] text-ink-nav"><span className="min-w-0 flex-1 truncate">servicepacts.com/review/k3p9…x7q2</span><Btn variant="ghost" aria-label="Copy link" onClick={() => toast.show("Link copied")} className="size-11 px-0 lg:size-8"><CopyIcon aria-hidden="true" /></Btn></div>
            <div className="mt-3 flex flex-wrap gap-2"><Btn onClick={() => toast.show("Link reissued. The old one stops working.")}>Reissue link</Btn><LinkBtn href={screenHref("portal")}>Open as customer</LinkBtn></div>
          </Section>
          <Section title="Versions"><ul className="flex flex-col gap-2 text-[14px]"><li className="flex items-center justify-between rounded-control bg-action-tint px-3 py-2 font-semibold text-action-press">Version 1<Chip tone="info">Current</Chip></li><li className="flex items-center justify-between px-3 py-2 text-ink-2">Version 2 draft<Btn variant="ghost">Compare</Btn></li></ul></Section>
          <Section title="Notes">
            <form onSubmit={(event) => { event.preventDefault(); if (note.trim()) { setNotes([note.trim(), ...notes]); setNote(""); toast.show("Note added"); } }} className="flex flex-col gap-2">
              <label><span className="sr-only">Add a note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Only your team sees notes" className={`${INPUT} h-auto py-2.5`} /></label>
              <Btn type="submit" className="self-end">Add note</Btn>
            </form>
            {notes.length > 0 && <ul className="mt-3 flex flex-col gap-2">{notes.map((n, i) => <li key={i} className="rounded-control bg-board px-3 py-2 text-[13px]">{n}</li>)}</ul>}
          </Section>
          <Section title="Activity"><ol className="flex flex-col gap-3">{ACTIVITY.map((a) => <li key={a.when + a.what} className="text-[13px]"><span className="font-semibold">{a.who}</span> {a.what}<p className="text-[12px] text-ink-2">{a.when}</p></li>)}</ol></Section>
        </aside>
      </div>

      <Modal open={pdf} onClose={() => setPdf(false)} title="PDF preview" sub="The page your customer receives." wide>
        <div className="rounded-card bg-board p-4"><div className="mx-auto flex max-w-xl flex-col gap-3 rounded-card bg-surface p-6 shadow-panel"><p className="text-[18px] font-bold">Blue Heron Mechanical</p><p className="text-[12px] text-ink-2">Service agreement · Harbour Point Tower · Dec 1, 2026 – Nov 30, 2027</p>{SERVICE_LINES.map((l) => <div key={l.name} className="flex justify-between border-t border-hairline pt-2 text-[13px]"><span>{l.name}</span><span className="font-semibold">{money(l.per)}</span></div>)}<div className="flex justify-between border-t border-ink pt-2 font-bold"><span>Annual total</span><span>{money(annual)}/yr</span></div></div></div>
      </Modal>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Send to Priya Anand?" sub="She gets an email with your link. Edits after this create a new version.">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Btn onClick={() => setConfirm(false)}>Cancel</Btn><Btn variant="primary" onClick={() => { setStage("sent"); setConfirm(false); toast.show("Sent to Priya Anand"); }}>Send to customer</Btn></div>
      </Modal>
      {toast.node}
    </div>
  );
}

/** The signed contract that follows an accepted agreement: its wording, the parties and the signatures. */
export function ContractScreen() {
  return (
    <div className="flex flex-col gap-6">
      <Back href={screenHref("agreement")}>AG-1042</Back>
      <PageHead title="Contract CT-0311" badge={<StagePill stage="completed" />} sub="Harbour Point Tower · Signed Nov 21, 2026" actions={<Btn><DownloadIcon aria-hidden="true" />Download signed PDF</Btn>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="Wording">{["Services. The contractor performs the visits listed in the agreement.", "Payment. Invoices are due net 30 days from the date of issue.", "Cancellation. Either party may cancel with 60 days written notice.", "Governing law. The laws of British Columbia."].map((clause, i) => <p key={clause} className="border-t border-hairline py-3 text-[14px] first:border-0 first:pt-0"><span className="mr-2 font-bold text-action">{i + 1}.</span>{clause}</p>)}</Section>
        <aside className="flex flex-col gap-6"><Section title="Signatures"><ul className="flex flex-col gap-3 text-[13px]"><li className="rounded-control bg-pill-completed px-3 py-2"><span className="font-semibold">Priya Anand</span> for Northgate Properties<p className="text-pill-completed-ink">Signed Nov 21, 2026, 14:20</p></li><li className="rounded-control bg-pill-completed px-3 py-2"><span className="font-semibold">Dana Whitfield</span> for Blue Heron Mechanical<p className="text-pill-completed-ink">Signed Nov 21, 2026, 15:02</p></li></ul></Section></aside>
      </div>
    </div>
  );
}
