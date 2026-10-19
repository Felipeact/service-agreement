import { StatusPill } from "@/components/ui/status-pill";
import { formatCad } from "@/lib/money";
import { STAGE_META, type PipelineStage } from "@/lib/pipeline-stage";
import type { PipelineCard } from "@/lib/sample-pipeline";
import { KanbanCard } from "./kanban-card";

type KanbanColumnProps = {
  stage: PipelineStage;
  cards: PipelineCard[];
  className?: string;
};

/** A Board Grey well headed by the stage, its card count and its annual CAD total. */
export function KanbanColumn({ stage, cards, className = "" }: KanbanColumnProps) {
  const totalCents = cards.reduce((sum, card) => sum + (card.annualCents ?? 0), 0);
  const titleId = `column-${stage}`;
  return (
    <section
      data-column={stage}
      id={`panel-${stage}`}
      aria-labelledby={titleId}
      className={`flex-col gap-2 rounded-panel bg-board p-2.5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 px-1 pt-0.5 pb-1.5">
        <h2 id={titleId} data-column-title className="text-[13px]">
          <StatusPill stage={stage} label={STAGE_META[stage].shortLabel} />
        </h2>
        <span data-column-count className="font-medium text-ink-2">
          {cards.length}
        </span>
        <span data-column-total className="ml-auto text-[12px] font-medium text-ink-2">
          {formatCad(totalCents)}/yr
        </span>
      </div>
      {cards.length === 0 ? (
        <p className="px-1 py-3 text-center text-[12px] text-ink-2">No agreements</p>
      ) : (
        cards.map((card) => <KanbanCard key={card.id} card={card} />)
      )}
    </section>
  );
}
