"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ImportHistoryRow, PipelineCard } from "@/application/ports";
import { LayoutGridIcon, ListIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { RooftopScene, Spot } from "@/components/ui/illustrations";
import { FOLLOW_UP_AFTER_DAYS, needsFollowUp, sortForColumn, type ExpiringAgreement } from "@/domain/pipeline";
import { PIPELINE_STAGES, STAGE_META, type PipelineStage } from "@/lib/pipeline-stage";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { ExpiringColumn } from "./expiring-column";
import { LiveRefresh } from "./live-refresh";
import { KanbanColumn } from "./kanban-column";
import { pipelineStats } from "@/lib/pipeline-stats";
import { PipelineSummary } from "./pipeline-summary";
import { RecentImports } from "./recent-imports";

/** The board's views: the five stages, then Expiring soon beside Refused. */
type View = PipelineStage | "expiring";
const VIEWS: View[] = [...PIPELINE_STAGES, "expiring"];

/** From tablet each column is at least 236px and the row scrolls; from 1280px the six columns share the work area so none is cut off. */
const COLUMN_CLASSES = "md:flex md:flex-[1_0_236px] xl:min-w-0 xl:flex-[1_1_0]";

/** What "needs follow-up" means, read from the thresholds the board uses so the two cannot drift apart. */
const FOLLOW_UP_RULE = `Follow up after ${FOLLOW_UP_AFTER_DAYS.in_progress} days in progress, ${FOLLOW_UP_AFTER_DAYS.sent} sent or accepted.`;

/** The age filter's choices: an agreement that has sat this many days in its stage or longer. */
const AGE_CHOICES = [
  { value: 0, label: "Any age" },
  { value: 7, label: "7+ days" },
  { value: 14, label: "14+ days" },
  { value: 30, label: "30+ days" },
];

/** True while a key press belongs to a field, a dialog or a shortcut chord, not to the board. */
function typingElsewhere(event: globalThis.KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target;
  if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true], dialog[open]")) return true;
  return Boolean(document.querySelector("dialog[open]"));
}

type PipelineViewProps = {
  cards: PipelineCard[];
  /** The page's title: a greeting for the member who just landed ("Good morning, Jamie"). */
  title?: string;
  canCreate?: boolean;
  /** Replaces the plain New agreement link, e.g. with the dialog that starts one (the page supplies it for writers). */
  newAgreement?: ReactNode;
  /** Accepted agreements ending soon: the sixth column, beside Refused. */
  expiring?: ExpiringAgreement[];
  /** The business day `expiring` was read for. */
  today?: string;
  /** The newest equipment imports, shown under the board. */
  imports?: ImportHistoryRow[];
  /** Open with the board narrowed to the agreements that need follow-up (the bell's link, `?followups=1`). */
  initialFollowUpOnly?: boolean;
};

/** "Live" beside the title: the board re-reads the server on its own (see `LiveRefresh`). */
function LivePill() {
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-pill-completed-border bg-pill-completed px-2.5 text-[11px] leading-4 font-semibold whitespace-nowrap text-pill-completed-ink">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-stage-completed" />
      Live CAD
    </span>
  );
}

/**
 * The Pipeline page body: a greeting, the three cards an estimator opens the app for (money in play, who is waiting on
 * the customer, what needs a nudge), then the board (tabs on mobile, a scrolling row of columns from tablet up). The app's
 * one search is the sidebar's, so the board has none of its own.
 */
export function PipelineView({ cards, title = "Sales Pipeline", canCreate = false, newAgreement, expiring = [], today = "", imports = [], initialFollowUpOnly = false }: PipelineViewProps) {
  const words = useItemWords();
  const [selected, setSelected] = useState<View>("in_progress");
  const [followUpOnly, setFollowUpOnly] = useState(initialFollowUpOnly);
  const [minAge, setMinAge] = useState(0);
  const [query, setQuery] = useState("");
  const tabRefs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});

  const stats = pipelineStats(cards, today);
  const needle = query.trim().toLowerCase();
  const shown = cards.filter((card) => (!followUpOnly || needsFollowUp(card)) && card.ageDays >= minAge && (!needle || `${card.site} ${card.customer}`.toLowerCase().includes(needle)));
  const filtered = followUpOnly || minAge > 0 || needle !== "";
  const byStage = (stage: PipelineStage) => sortForColumn(stage, shown.filter((card) => card.stage === stage));
  const countOf = (view: View) => (view === "expiring" ? expiring.length : byStage(view).length);
  const empty = cards.length === 0 && expiring.length === 0;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = VIEWS[(index + step + VIEWS.length) % VIEWS.length];
    setSelected(next);
    tabRefs.current[next]?.focus();
  }

  // j and k step through the cards on screen, Enter (a card is a link) opens the one in focus.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.key !== "j" && event.key !== "k") || typingElsewhere(event)) return;
      const cardsOnScreen = [...document.querySelectorAll<HTMLElement>("[data-board] [data-card], [data-board] [data-expiring]")].filter((node) => node.offsetParent !== null);
      if (cardsOnScreen.length === 0) return;
      event.preventDefault();
      const at = cardsOnScreen.findIndex((node) => node === document.activeElement);
      const next = event.key === "j" ? Math.min(at + 1, cardsOnScreen.length - 1) : Math.max(at === -1 ? 0 : at - 1, 0);
      cardsOnScreen[next].focus();
      cardsOnScreen[next].scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const visible = (view: View) => (view === selected ? "flex" : "hidden");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        large
        title={title}
        badge={<LivePill />}
        subtitle={itemText("Keep every service agreement moving from equipment intake to signed contract.", words)}
        action={
          <>
            {!empty && (
              <button
                type="button"
                onClick={() => setFollowUpOnly(true)}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-control bg-violet-600 px-3.5 text-[13px] font-medium whitespace-nowrap text-white shadow-card transition-colors duration-150 hover:bg-violet-700 lg:h-[38px]"
              >
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                Insights ({stats.followUpCount})
              </button>
            )}
            {canCreate ? newAgreement : undefined}
          </>
        }
      />

      {empty ? (
        <EmptyPanel title="No agreements yet" text={itemText("Add the customer and site, import the equipment list, review the rows, then send a priced agreement. It appears here by stage, with its age.", words)} art={<RooftopScene className="w-56 text-ink-2" />} />
      ) : (
        <>
          <PipelineSummary stats={stats} expiring={expiring} />

          <section aria-labelledby="board-title" className="flex flex-col gap-4">
            <h2 id="board-title" className="sr-only">
              Deal pipeline
            </h2>
            <div className="flex flex-wrap items-end gap-x-2.5 gap-y-3 rounded-panel border border-hairline bg-surface p-3 shadow-card">
              <label className="relative block w-full sm:w-60">
                <span className="sr-only">Search deal name or company</span>
                <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-2" />
                <input
                  type="search"
                  placeholder="Search deal name or company…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 w-full rounded-control border border-field bg-surface pr-3 pl-8 text-[13px] text-ink placeholder:text-ink-2 focus:border-action focus:ring-1 focus:ring-action focus:outline-none lg:h-10"
                />
              </label>
              <button
                type="button"
                data-summary="follow-ups"
                aria-pressed={followUpOnly}
                onClick={() => setFollowUpOnly((on) => !on)}
                title={FOLLOW_UP_RULE}
                className="inline-flex h-11 items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-[13px] font-semibold whitespace-nowrap text-ink transition-colors duration-150 hover:border-line-strong aria-pressed:border-action aria-pressed:bg-action-tint aria-pressed:text-action-press lg:h-10"
              >
                Follow-ups due
                <span className={`rounded-full px-1.5 text-[11px] ${stats.followUpCount > 0 ? "bg-attention-bg text-attention-fg" : "bg-board text-ink-2"}`}>{stats.followUpCount}</span>
              </button>
              <label className="flex flex-col gap-1">
                <span className="sr-only">Time in stage</span>
                <select id="board-age" value={minAge} onChange={(event) => setMinAge(Number(event.target.value))} className="h-11 w-40 rounded-control border border-field bg-surface px-3 text-[13px] text-ink lg:h-10">
                  {AGE_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="sr-only">Press j and k to move between cards.</p>
              <div className="ml-auto inline-flex rounded-control bg-board p-0.5 text-[13px] font-semibold">
                <span aria-current="true" className="inline-flex h-11 items-center gap-1.5 rounded-control bg-surface px-3 text-action shadow-card lg:h-8">
                  <LayoutGridIcon className="size-4" aria-hidden="true" />
                  Kanban
                </span>
                <Link href="/agreements" className="inline-flex h-11 items-center gap-1.5 rounded-control px-3 text-ink-2 transition-colors duration-150 hover:text-ink lg:h-8">
                  <ListIcon className="size-4" aria-hidden="true" />
                  List
                </Link>
              </div>
              <div className="sr-only">
                <LiveRefresh />
              </div>
            </div>

            {filtered && shown.length === 0 ? (
              <EmptyPanel
                title={followUpOnly ? "Nothing needs follow-up" : "No agreements this old"}
                text={followUpOnly ? "Every open agreement is within its follow-up time." : "Every agreement changed more recently than that."}
                art={<Spot kind="signature" />}
              >
                <Button
                  onClick={() => {
                    setFollowUpOnly(false);
                    setMinAge(0);
                  }}
                >
                  Show all agreements
                </Button>
              </EmptyPanel>
            ) : (
              <>
                <div role="tablist" aria-label="Pipeline stage" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
                  {VIEWS.map((view, index) => {
                    const active = view === selected;
                    const waiting = view === "expiring" ? 0 : byStage(view).filter(needsFollowUp).length;
                    const label = view === "expiring" ? "Expiring soon" : STAGE_META[view].shortLabel;
                    return (
                      <button
                        key={view}
                        ref={(node) => {
                          tabRefs.current[view] = node;
                        }}
                        type="button"
                        role="tab"
                        id={`tab-${view}`}
                        aria-selected={active}
                        aria-controls={`panel-${view}`}
                        tabIndex={active ? 0 : -1}
                        onClick={() => setSelected(view)}
                        onKeyDown={(event) => onTabKeyDown(event, index)}
                        className={`relative inline-flex h-11 shrink-0 items-center gap-2 rounded-control border px-3 font-semibold whitespace-nowrap ${
                          active ? "border-action bg-action-tint text-action" : "border-hairline bg-surface text-ink"
                        }`}
                      >
                        <span aria-hidden="true" className={`size-2 rounded-full ${view === "expiring" ? "bg-attention-fg" : STAGE_META[view].dotClass}`} />
                        {label}
                        <span className={active ? "text-action" : "text-ink-2"}>{countOf(view)}</span>
                        {waiting > 0 && (
                          <span className="rounded-full bg-attention-bg px-1.5 text-[11px] leading-4 font-semibold text-attention-fg">
                            {waiting}
                            <span className="sr-only"> to follow up</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div data-board className="flex flex-col gap-3.5 md:flex-row md:overflow-x-auto md:pb-3 lg:gap-4">
                  {PIPELINE_STAGES.map((stage) => (
                    <KanbanColumn key={stage} stage={stage} cards={byStage(stage)} className={`${visible(stage)} ${COLUMN_CLASSES}`} />
                  ))}
                  <ExpiringColumn rows={expiring} today={today} className={`${visible("expiring")} ${COLUMN_CLASSES}`} />
                </div>
              </>
            )}
          </section>
        </>
      )}

      <RecentImports jobs={imports} />
    </div>
  );
}
