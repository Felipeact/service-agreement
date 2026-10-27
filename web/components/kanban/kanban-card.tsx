import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCad } from "@/lib/money";
import type { PipelineCard } from "@/application/ports";
import { ageLabel } from "@/lib/age";

export function KanbanCard({ card }: { card: PipelineCard }) {
  return (
    <Link
      href={`/agreements/${card.id}`}
      data-card
      data-amount-cents={card.annualCents ?? 0}
      className="block rounded-control bg-surface px-3 py-2.5 text-ink shadow-card hover:ring-1 hover:ring-action"
    >
      <h3 className="text-[13.5px] leading-snug font-semibold">{card.customer}</h3>
      <p className="mt-0.5 text-[12px] text-ink-2">{card.number ?? "Unnumbered"} · v{card.versionNo}</p>
      <p className="text-[12px] text-ink-2">{ageLabel(card.ageDays)}</p>
      {card.attention && (
        <div className="mt-2">
          <StatusPill tone="attention" label={card.attention} />
        </div>
      )}
      {card.annualCents !== undefined && (
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 text-[12px] text-ink-2">
          <span>{card.visitsPerYear} visits/yr</span>
          <span className="ml-auto font-semibold text-ink">{formatCad(card.annualCents)}/yr</span>
        </div>
      )}
    </Link>
  );
}
