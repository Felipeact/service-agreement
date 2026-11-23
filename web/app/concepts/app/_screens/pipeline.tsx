"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClockIcon, ChevronRightIcon, ClockIcon, LayoutGridIcon, ListIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { DEALS, EXPIRING, STAGES, STAGE_ORDER, money, type Deal, type StageKey } from "../_components/data";
import { Btn, Chip, Empty, INPUT, LinkBtn, PANEL, PageHead, Section, Stat, Table, TD, LINK } from "../_components/kit";
import { NewAgreementButton } from "../_components/new-agreement";
import { Tabs } from "../_components/kit-client";
import { screenHref } from "../_components/shell-parts";

type View = StageKey | "expiring";
const TABS: { key: View; label: string }[] = [...STAGE_ORDER.map((key) => ({ key, label: STAGES[key].label })), { key: "expiring", label: "Expiring soon" }];
const total = (deals: Deal[]) => deals.reduce((sum, deal) => sum + deal.annual, 0);

function DealCard({ deal }: { deal: Deal }) {
  const closed = deal.stage === "completed" || deal.stage === "refused";
  return (
    <Link href={screenHref("agreement")} className="pv-card group relative block overflow-hidden rounded-card border border-surface bg-surface p-4 shadow-card transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-lift">
      {deal.attention && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-attention-fg" />}
      <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-ink-2">
        <span>{deal.number} · v1</span>
        <span className="inline-flex items-center gap-1"><ClockIcon aria-hidden="true" className="size-3.5" />{deal.days}d<span className="sr-only"> since the last change</span></span>
      </div>
      <h3 className={`mt-2.5 text-[15px] leading-snug tracking-tight ${closed ? "font-medium" : "font-semibold"}`}>{deal.site}</h3>
      <p className="text-[12px] text-ink-2">{deal.customer}</p>
      {deal.attention && <div className="mt-2"><Chip tone="attention">{deal.attention}</Chip></div>}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-3">
        <span className={`inline-flex flex-col rounded-control px-2 py-1 leading-snug ${closed ? "bg-board text-ink-2" : "bg-pill-completed text-pill-completed-ink"}`}>
          <span className="text-[14px] font-semibold">{money(deal.annual)}/yr</span>
          <span className="text-[12px] font-medium">{deal.visits} visits/yr</span>
        </span>
        <ChevronRightIcon aria-hidden="true" className="size-4 text-ink-2 transition-transform group-hover:translate-x-0.5 group-hover:text-action" />
      </div>
    </Link>
  );
}

function Header({ id, dot, title, count, sum, note, pill }: { id: string; dot: string; title: React.ReactNode; count: number; sum: string; note?: string; pill?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 pt-0.5 pb-2">
      <h2 id={id} className="flex items-center gap-2 text-[14px] font-semibold tracking-tight whitespace-nowrap max-md:sr-only">
        <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />{title}
      </h2>
      <span className="flex basis-full flex-wrap items-center gap-x-1.5 text-[12px] font-medium text-ink-2 max-md:order-first">
        <span>{count} {count === 1 ? "Deal" : "Deals"}</span><span aria-hidden="true">·</span><span>{sum}</span>{note && <span className="font-normal">{note}</span>}{pill}
      </span>
    </div>
  );
}

/** The Pipeline: summary cards, filters, then five stage columns and Expiring soon as the sixth. A tab per column on a phone. */
export function PipelineScreen({ initialFollowUps = false }: { initialFollowUps?: boolean }) {
  const [view, setView] = useState<View>("in_progress");
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [minAge, setMinAge] = useState(0);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = DEALS.filter((deal) => (!followUps || deal.attention) && deal.days >= minAge && (!needle || `${deal.site} ${deal.customer} ${deal.number}`.toLowerCase().includes(needle)));
  const open = DEALS.filter((deal) => deal.stage !== "completed" && deal.stage !== "refused");
  const visible = (key: View) => (key === view ? "flex" : "hidden");

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        title="Sales Pipeline"
        badge={<Chip tone="good">● Live CAD</Chip>}
        sub="Keep every service agreement moving from intake to signed contract."
        actions={<><Btn onClick={() => setFollowUps(true)} className="border-violet-200 bg-violet-600 text-surface shadow-none hover:bg-violet-700"><SparklesIcon aria-hidden="true" />Insights (2)</Btn><NewAgreementButton /></>}
      />

      <dl className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pipeline value" value={<>{money(total(open))}<span className="ml-1.5 text-[12px] font-medium text-ink-2">CAD</span></>} note="4 agreements in motion · annualized" />
        <Stat label="Total deals active" value={open.length} note="1 aging under 7 days · 2 need follow-up" />
        <Stat label="Deals won (this month)" value={money(18800)} note="1 signed · 50% win rate" />
        <Stat label="Expiring soon" value={EXPIRING.length} tone="attention" note={`${money(total(EXPIRING.map((e) => ({ annual: e.annual }) as Deal)))}/yr ends within 90 days`} />
      </dl>

      <section aria-label="Deal pipeline" className="flex flex-col gap-4">
        <div className={`${PANEL} flex flex-wrap items-end gap-x-2.5 gap-y-3 p-3`}>
          <label className="relative block w-full sm:w-60">
            <span className="sr-only">Search deal name or company</span>
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-2" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search deal name or company…" className={`${INPUT} pl-8 text-[13px]`} />
          </label>
          <button type="button" aria-pressed={followUps} onClick={() => setFollowUps((on) => !on)} className="inline-flex h-11 items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-[13px] font-semibold hover:border-line-strong aria-pressed:border-action aria-pressed:bg-action-tint aria-pressed:text-action-press lg:h-10">
            Follow-ups due <span className="rounded-full bg-attention-bg px-1.5 text-[11px] text-attention-fg">2</span>
          </button>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Time in stage</span>
            <select value={minAge} onChange={(event) => setMinAge(Number(event.target.value))} className={`${INPUT} w-40 text-[13px]`}>
              <option value={0}>Any age</option><option value={7}>7+ days</option><option value={14}>14+ days</option><option value={30}>30+ days</option>
            </select>
          </label>
          <div className="ml-auto inline-flex rounded-control bg-board p-0.5 text-[13px] font-semibold">
            <span aria-current="true" className="inline-flex h-11 items-center gap-1.5 rounded-control bg-surface px-3 text-action shadow-card lg:h-8"><LayoutGridIcon aria-hidden="true" className="size-4" />Kanban</span>
            <Link href={screenHref("agreements")} className="inline-flex h-11 items-center gap-1.5 rounded-control px-3 text-ink-2 hover:text-ink lg:h-8"><ListIcon aria-hidden="true" className="size-4" />List</Link>
          </div>
        </div>

        {shown.length === 0 && (followUps || minAge > 0 || needle) ? (
          <Empty title="Nothing matches" text="Every open agreement is within its follow-up time, or no deal matches the search." action={<Btn onClick={() => { setFollowUps(false); setMinAge(0); setQuery(""); }}>Show all agreements</Btn>} />
        ) : (
          <>
            <div role="tablist" aria-label="Pipeline stage" className="md:hidden">
              <Tabs label="Pipeline stage" value={view} onChange={setView} tabs={TABS.map((tab) => ({ ...tab, count: tab.key === "expiring" ? EXPIRING.length : shown.filter((deal) => deal.stage === tab.key).length }))} />
            </div>
            <div className="flex flex-col gap-3.5 md:flex-row md:overflow-x-auto md:pb-3 lg:gap-4">
              {STAGE_ORDER.map((stage) => {
                const deals = shown.filter((deal) => deal.stage === stage);
                const closed = stage === "completed" || stage === "refused";
                return (
                  <section key={stage} data-column={stage} aria-labelledby={`col-${stage}`} className={`pv-well ${visible(stage)} flex-col gap-2.5 rounded-panel p-3 md:flex md:flex-[1_0_236px] xl:min-w-0 xl:flex-[1_1_0] xl:p-2.5 ${STAGES[stage].tint}`}>
                    <Header id={`col-${stage}`} dot={STAGES[stage].dot} title={STAGES[stage].label} count={deals.length} sum={`${money(total(deals))}/yr`} note={closed ? (stage === "completed" ? "signed" : "not won") : undefined} pill={deals.some((d) => d.attention) ? <Chip tone="attention">{deals.filter((d) => d.attention).length} to follow up</Chip> : undefined} />
                    {deals.length === 0 ? <p className="rounded-control border border-dashed border-line-strong px-3 py-8 text-center text-[12px] text-ink-2">No agreements here</p> : deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
                  </section>
                );
              })}
              <section data-column="expiring" aria-labelledby="col-expiring" className={`pv-well ${visible("expiring")} flex-col gap-2.5 rounded-panel bg-tint-expiring p-3 md:flex md:flex-[1_0_236px] xl:min-w-0 xl:flex-[1_1_0] xl:p-2.5`}>
                <Header id="col-expiring" dot="bg-attention-fg" title={<Link href={screenHref("expiring")} className="relative hover:underline after:absolute after:-inset-x-2 after:-inset-y-3">Expiring soon</Link>} count={EXPIRING.length} sum={`${money(EXPIRING.reduce((s, e) => s + e.annual, 0))}/yr`} note="ends in 90 days" />
                {EXPIRING.map((row) => (
                  <Link key={row.id} href={screenHref("expiring")} className="pv-card block rounded-card border border-surface bg-surface p-4 shadow-card transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-lift">
                    <div className="flex items-center justify-between gap-2"><Chip tone="attention">Ends {row.ends}</Chip><span className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger"><ClockIcon aria-hidden="true" className="size-3.5" />{row.left}d</span></div>
                    <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{row.site}</h3>
                    <p className="text-[12px] text-ink-2">{row.customer} · {row.number}</p>
                    <p className="mt-2 text-[12px] text-ink-2">{row.note}</p>
                    <p className="mt-3 border-t border-hairline pt-3 text-[15px] font-semibold">{money(row.annual)}/yr</p>
                  </Link>
                ))}
              </section>
            </div>
          </>
        )}
      </section>

      <Section title="Recent imports" action={<LinkBtn href={screenHref("imports")}>All imports</LinkBtn>}>
        <ul className="divide-y divide-hairline text-[14px]">
          {[["units.csv", "Harbour Point Tower", "34 of 38 rows recognized"], ["boiler-room.xlsx", "Elm Street School", "12 of 12 rows recognized"]].map(([file, site, note]) => (
            <li key={file} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"><span className="font-semibold">{file}</span><span className="text-ink-2">{site}</span><span className="ml-auto text-[12px] text-ink-2">{note}</span></li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/** `?view=expiring`: every accepted agreement ending in the next 90 days, soonest first, with what renewal will do. */
export function ExpiringScreen() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Expiring soon" sub="Accepted agreements ending in the next 90 days, soonest first." actions={<LinkBtn href={screenHref("pipeline")}>Back to the board</LinkBtn>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <dl className="contents"><Stat label="Ending in 90 days" value={EXPIRING.length} /><Stat label="At stake" value={`${money(EXPIRING.reduce((s, e) => s + e.annual, 0))}/yr`} /><Stat label="Auto-renew" value="1" note="1 needs renegotiation" /></dl>
      </div>
      <Section flush title="Ending soon" sub="Soonest first">
        <Table head={["Agreement", "Customer", "Ends", "Per year", "Renewal"]}>
          {EXPIRING.map((row) => (
            <tr key={row.id} className="hover:bg-ground/70">
              <td className={TD}><Link href={screenHref("agreement")} className={LINK}>{row.number}</Link><p className="text-[12px] text-ink-2">{row.site}</p></td>
              <td className={TD}>{row.customer}</td>
              <td className={TD}><span className="inline-flex items-center gap-1.5"><CalendarClockIcon aria-hidden="true" className="size-4 text-attention-fg" />{row.ends} <Chip tone="attention">{row.left} days</Chip></span></td>
              <td className={`${TD} font-semibold`}>{money(row.annual)}</td>
              <td className={`${TD} text-ink-nav`}>{row.note}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
