import { Icon } from "@/components/ui/icons";
import { CountUp } from "@/components/motion/count-up";
import { formatCad } from "@/lib/money";

const formatCount = (value: number) => String(value);

type SummaryProps = {
  /** Annual CAD cents still in play: In progress, Sent and Accepted. */
  openCents: number;
  /** Agreements in those stages. */
  openCount: number;
  /** Of those, how many have no service lines and so add nothing to the total. */
  unpricedCount?: number;
  /** Agreements waiting on the customer: stage Sent. */
  waitingCount: number;
  /** Agreements that need the estimator: an attention label, or sat past their stage's limit. */
  followUpCount: number;
  /** The board shows only the cards that need follow-up. */
  followUpOnly: boolean;
  onToggleFollowUp: () => void;
};

/**
 * The three questions an estimator opens the app with: how much is in play, who has not answered, and what needs a
 * nudge today. The last card is also the board's follow-up filter, so the number and what it counts are one tap apart.
 */
export function PipelineSummary({ openCents, openCount, unpricedCount = 0, waitingCount, followUpCount, followUpOnly, onToggleFollowUp }: SummaryProps) {
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
      <div data-summary="open" className="col-span-2 flex flex-col gap-2 rounded-panel bg-night p-5 text-surface shadow-card sm:col-span-1">
        <span className="flex items-center justify-between text-[13px] font-medium text-night-ink">
          Open pipeline
          <Icon name="trend" className="size-[18px]" />
        </span>
        {openCents === 0 && openCount > 0 ? (
          <>
            <span className="font-display text-[32px] leading-none font-medium tracking-tight">
              Unpriced
            </span>
            <span className="text-[12px] text-night-ink">
              {openCount} {openCount === 1 ? "agreement" : "agreements"} in motion, priced once service lines are added
            </span>
          </>
        ) : (
          <>
            <CountUp className="font-display text-[32px] leading-none font-medium tracking-tight" value={openCents} format={formatCad} snap={100} />
            <span className="text-[12px] text-night-ink">
              {openCount} {openCount === 1 ? "agreement" : "agreements"} in motion · annual value{unpricedCount > 0 ? `, ${unpricedCount} unpriced` : ""}
            </span>
          </>
        )}
      </div>

      <div data-summary="waiting" className="flex flex-col gap-2 rounded-panel border border-hairline bg-surface p-4 shadow-card sm:p-5">
        <span className="flex items-center justify-between text-[13px] font-medium text-ink-2">
          Waiting on customer
          <Icon name="clock" className="size-[18px]" />
        </span>
        <CountUp className="font-display text-[32px] leading-none font-medium tracking-tight text-ink" value={waitingCount} format={formatCount} />
        <span className="text-[12px] text-ink-2">Sent, no decision yet</span>
      </div>

      <button
        type="button"
        data-summary="follow-ups"
        aria-pressed={followUpOnly}
        onClick={onToggleFollowUp}
        className={`flex flex-col gap-2 rounded-panel border p-4 text-left shadow-card transition-colors duration-150 sm:p-5 ${
          followUpOnly
            ? "border-action bg-action-tint"
            : followUpCount > 0
              ? "border-attention-fg/30 bg-attention-bg/50 hover:bg-attention-bg"
              : "border-hairline bg-surface hover:bg-ground"
        }`}
      >
        <span className={`flex items-center justify-between text-[13px] font-medium ${followUpCount > 0 && !followUpOnly ? "text-attention-fg" : "text-ink-2"}`}>
          Follow-ups due
          <Icon name="bell" className="size-[18px]" />
        </span>
        <CountUp className={`font-display text-[32px] leading-none font-medium tracking-tight ${followUpCount > 0 && !followUpOnly ? "text-attention-fg" : "text-ink"}`} value={followUpCount} format={formatCount} />
        <span className={`text-[12px] ${followUpCount > 0 && !followUpOnly ? "text-attention-fg" : "text-ink-2"}`}>
          {followUpOnly ? "Showing only these. Select to show all." : followUpCount > 0 ? "Needs attention. Select to filter the board." : "Nothing is overdue"}
        </span>
      </button>
    </div>
  );
}
