import type { ReactNode } from "react";
import type { PipelineCard } from "@/application/ports";
import { Spot } from "@/components/ui/illustrations";
import { StatusPill } from "@/components/ui/status-pill";
import { needsFollowUp } from "@/domain/pipeline";
import { formatCad } from "@/lib/money";
import { STAGE_META, type PipelineStage } from "@/lib/pipeline-stage";
import { KanbanCard } from "./kanban-card";

/**
 * The header every column shares: a dot and the stage name in the display face, the card count, and the annual total
 * beneath, so every column's first card starts at the same height. Below 768px the tab above the board
 * already names the stage and its count, so the header keeps them for screen readers only.
 */
export function ColumnHeader({
  id,
  title,
  dotClass,
  count,
  total,
  note,
  pill,
  attr = "data-column-title",
}: {
  id: string;
  /** The stage name; a link for Expiring soon, which has a page of its own. */
  title: ReactNode;
  dotClass: string;
  count: number;
  total: string;
  note?: string;
  pill?: ReactNode;
  attr?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 pt-0.5 pb-2">
      <h2 id={id} {...{ [attr]: "" }} className="flex items-center gap-2 font-display text-[14px] font-semibold tracking-tight text-ink max-md:sr-only">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dotClass}`} />
        {title}
      </h2>
      <span data-column-count className="font-medium text-ink-2 max-md:sr-only">
        {count}
      </span>
      <span className="flex basis-full flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-ink-2 max-md:order-first">
        <span data-column-total>{total}</span>
        {note && <span className="font-normal">{note}</span>}
        {pill}
      </span>
    </div>
  );
}

type KanbanColumnProps = {
  stage: PipelineStage;
  cards: PipelineCard[];
  className?: string;
};

/**
 * A well headed by the stage (tinted with its hue while the stage is open), its card count, its annual CAD total and how many cards need a follow-up. A closed
 * stage's total says what the money was ("signed", "not won") so it is not read as pipeline.
 */
export function KanbanColumn({ stage, cards, className = "" }: KanbanColumnProps) {
  const totalCents = cards.reduce((sum, card) => sum + (card.annualCents ?? 0), 0);
  const followUps = cards.filter(needsFollowUp).length;
  const meta = STAGE_META[stage];
  return (
    <section data-column={stage} id={`panel-${stage}`} aria-labelledby={`column-${stage}`} className={`flex-col gap-2.5 rounded-panel p-3 ${meta.wellClass} ${className}`}>
      <ColumnHeader
        id={`column-${stage}`}
        title={meta.shortLabel}
        dotClass={meta.dotClass}
        count={cards.length}
        total={`${formatCad(totalCents)}/yr`}
        note={meta.totalNote}
        pill={
          followUps > 0 ? (
            <span data-column-follow-up>
              <StatusPill tone="attention" label={`${followUps} to follow up`} />
            </span>
          ) : undefined
        }
      />
      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-1 py-5 text-center text-ink-2">
          {meta.emptySpot && <Spot kind={meta.emptySpot} className="size-14 opacity-80" />}
          <p className="text-[12px]">{meta.emptyText}</p>
        </div>
      ) : (
        cards.map((card, index) => <KanbanCard key={card.id} card={card} index={index} />)
      )}
    </section>
  );
}
