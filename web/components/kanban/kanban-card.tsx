import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/status-pill";
import { followUpLabel, isClosedStage } from "@/domain/pipeline";
import { formatCad } from "@/lib/money";
import type { PipelineCard } from "@/application/ports";
import { ageLabel, ageShort } from "@/lib/age";

/**
 * One agreement: its number and its age beside a clock, then the site, the customer, any pills that
 * need the estimator (and a follow-up once the deal has sat past its stage's threshold), and the money with a chevron.
 * A closed deal recedes: a medium-weight title and a grey amount.
 */
export function KanbanCard({ card, index = 0 }: { card: PipelineCard; index?: number }) {
  const closed = isClosedStage(card.stage);
  const followUp = followUpLabel(card);
  // A site named after its customer ("Fernwood Dental" at "Fernwood Dental") needs saying once.
  const showCustomer = card.customer.trim().toLowerCase() !== card.site.trim().toLowerCase();
  return (
    <Link
      href={`/agreements/${card.id}`}
      data-card
      data-amount-cents={card.annualCents ?? 0}
      style={{ "--i": index } as CSSProperties}
      className="settle block rounded-panel border border-hairline bg-surface p-4 text-ink shadow-card xl:max-[1600px]:p-3.5 transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-lift"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium whitespace-nowrap text-ink-2">{card.number ?? "Unnumbered"} · v{card.versionNo}</span>
        <span title={ageLabel(card.ageDays)} className="inline-flex items-center gap-1 text-[12px] text-ink-2">
          <Icon name="clock" className="size-3.5 xl:max-[1600px]:hidden" />
          <span aria-hidden="true">{ageShort(card.ageDays)}</span>
          <span className="sr-only">{ageLabel(card.ageDays)}</span>
        </span>
      </div>
      <h3 className={`mt-2.5 font-display text-[15px] leading-snug tracking-tight ${closed ? "font-medium" : "font-semibold"}`}>{card.site}</h3>
      {showCustomer && <p className="text-[12px] text-ink-2">{card.customer}</p>}
      {(card.attention || followUp || card.isRenewal || card.status === "expired") && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.isRenewal && <StatusPill tone="neutral" label="Renewal" />}
          {card.status === "expired" && <StatusPill tone="neutral" label="Expired" />}
          {card.attention && <StatusPill tone="attention" label={card.attention} />}
          {followUp && <StatusPill tone="attention" label={followUp} />}
        </div>
      )}
      <div className="mt-3 flex items-end justify-between gap-2 border-t border-hairline pt-3">
        {card.annualCents !== undefined ? (
          <div className="flex flex-col">
            <span className={`text-[15px] font-semibold ${closed ? "text-ink-2" : "text-ink"}`}>{formatCad(card.annualCents)}/yr</span>
            <span className="text-[12px] text-ink-2">{card.visitsPerYear} visits/yr</span>
          </div>
        ) : (
          <span className="text-[12px] text-ink-2">No service lines yet</span>
        )}
        <Icon name="chevron" className="size-4 text-ink-2" />
      </div>
    </Link>
  );
}
