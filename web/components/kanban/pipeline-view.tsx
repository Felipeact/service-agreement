"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ImportHistoryRow, PipelineCard } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Icon } from "@/components/ui/icons";
import { RooftopScene, Spot } from "@/components/ui/illustrations";
import { LinkButton } from "@/components/ui/link-button";
import { isClosedStage, needsFollowUp, sortForColumn, type ExpiringAgreement } from "@/domain/pipeline";
import { PIPELINE_STAGES, STAGE_META, type PipelineStage } from "@/lib/pipeline-stage";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { ExpiringColumn } from "./expiring-column";
import { KanbanColumn } from "./kanban-column";
import { PipelineSummary } from "./pipeline-summary";
import { RecentImports } from "./recent-imports";

/** The board's views: the five stages, then Expiring soon beside Refused. */
type View = PipelineStage | "expiring";
const VIEWS: View[] = [...PIPELINE_STAGES, "expiring"];

const COLUMN_CLASSES = "md:flex md:flex-[1_0_236px]";

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
  const tabRefs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});

  const open = cards.filter((card) => !isClosedStage(card.stage));
  const openCents = open.reduce((sum, card) => sum + (card.annualCents ?? 0), 0);
  const waitingCount = cards.filter((card) => card.stage === "sent").length;
  const followUpCount = cards.filter(needsFollowUp).length;

  const shown = followUpOnly ? cards.filter(needsFollowUp) : cards;
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

  const visible = (view: View) => (view === selected ? "flex" : "hidden");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        large
        title={title}
        subtitle={itemText("Keep every service agreement moving from equipment list to signature.", words)}
        action={
          newAgreement ??
          (canCreate ? (
            <LinkButton href="/agreements/new" variant="primary">
              <Icon name="plus" className="size-4" />
              New agreement
            </LinkButton>
          ) : undefined)
        }
      />

      {empty ? (
        <EmptyPanel title="No agreements yet" text="Agreements you create appear here by stage." art={<RooftopScene className="w-56 text-ink-2" />} />
      ) : (
        <>
          <PipelineSummary
            openCents={openCents}
            openCount={open.length}
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
                <p className="text-[13px] text-ink-2">Aging starts when an agreement enters each stage.</p>
              </div>
              <Link href="/agreements" className="inline-flex min-h-11 shrink-0 items-center text-[13px] font-medium whitespace-nowrap text-action lg:min-h-0">
                View list
              </Link>
            </div>

            {followUpOnly && shown.length === 0 ? (
              <EmptyPanel title="Nothing needs follow-up" text="Every open agreement is within its follow-up time." art={<Spot kind="signature" />}>
                <Button onClick={() => setFollowUpOnly(false)}>Show all agreements</Button>
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
