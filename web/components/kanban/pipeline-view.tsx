"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ImportHistoryRow, PipelineCard } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Select } from "@/components/ui/select";
import { RooftopScene, Spot } from "@/components/ui/illustrations";
import { FOLLOW_UP_AFTER_DAYS, isClosedStage, needsFollowUp, sortForColumn, type ExpiringAgreement } from "@/domain/pipeline";
import { PIPELINE_STAGES, STAGE_META, type PipelineStage } from "@/lib/pipeline-stage";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { ExpiringColumn } from "./expiring-column";
import { LiveRefresh } from "./live-refresh";
import { KanbanColumn } from "./kanban-column";
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

/**
 * The Pipeline page body: a greeting, the three cards an estimator opens the app for (money in play, who is waiting on
 * the customer, what needs a nudge), then the board (tabs on mobile, a scrolling row of columns from tablet up). The app's
 * one search is the sidebar's, so the board has none of its own.
 */
export function PipelineView({ cards, title = "Pipeline", canCreate = false, newAgreement, expiring = [], today = "", imports = [], initialFollowUpOnly = false }: PipelineViewProps) {
  const words = useItemWords();
  const [selected, setSelected] = useState<View>("in_progress");
  const [followUpOnly, setFollowUpOnly] = useState(initialFollowUpOnly);
  const [minAge, setMinAge] = useState(0);
  const tabRefs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});

  const open = cards.filter((card) => !isClosedStage(card.stage));
  const openCents = open.reduce((sum, card) => sum + (card.annualCents ?? 0), 0);
  const waitingCount = cards.filter((card) => card.stage === "sent").length;
  const followUpCount = cards.filter(needsFollowUp).length;
  const unpricedCount = open.filter((card) => card.annualCents === undefined).length;

  const shown = cards.filter((card) => (!followUpOnly || needsFollowUp(card)) && card.ageDays >= minAge);
  const filtered = followUpOnly || minAge > 0;
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
        subtitle={itemText("Keep every service agreement moving from equipment list to signature.", words)}
        action={canCreate ? newAgreement : undefined}
      />

      {empty ? (
        <EmptyPanel title="No agreements yet" text="Add the customer and site, import the equipment list, review the rows, then send a priced agreement. It appears here by stage, with its age." art={<RooftopScene className="w-56 text-ink-2" />} />
      ) : (
        <>
          <PipelineSummary
            openCents={openCents}
            openCount={open.length}
            unpricedCount={unpricedCount}
            waitingCount={waitingCount}
            followUpCount={followUpCount}
            followUpOnly={followUpOnly}
            onToggleFollowUp={() => setFollowUpOnly((on) => !on)}
          />

          <section aria-labelledby="board-title" className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col">
                <h2 id="board-title" className="font-display text-[19px] font-semibold tracking-tight">
                  Agreement pipeline
                </h2>
                <p className="text-[13px] text-ink-2">Aging starts when an agreement enters a stage. {FOLLOW_UP_RULE}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <Link href="/agreements" className="inline-flex min-h-11 items-center text-[13px] font-medium whitespace-nowrap text-action lg:min-h-0">
                  View list
                </Link>
                <LiveRefresh />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <Select id="board-age" label="Time in stage" value={minAge} onChange={(event) => setMinAge(Number(event.target.value))} className="w-40">
                {AGE_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </Select>
              <p className="pb-2 text-[12px] text-ink-2 max-md:hidden">Press j and k to move between cards.</p>
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
