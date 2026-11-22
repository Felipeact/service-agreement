import type { PipelineCard } from "@/application/ports";
import { isClosedStage, needsFollowUp } from "@/domain/pipeline";

/** An open agreement that changed stage within this many days counts as "aging under 14 days". */
export const FRESH_UNDER_DAYS = 14;

export type PipelineStats = {
  /** Annual CAD cents still in play: In progress, Sent and Accepted. */
  openCents: number;
  /** Agreements in those stages. */
  openCount: number;
  /** Of those, how many have no service lines and so add nothing to the total. */
  unpricedCount: number;
  /** Open agreements that changed stage in the last `FRESH_UNDER_DAYS` days. */
  freshCount: number;
  /** Agreements that need the estimator: an attention label, or sat past their stage's limit. */
  followUpCount: number;
  /** Agreements completed (signed) since the first of this month, and their annual cents. */
  signedCount: number;
  signedCents: number;
  /** Signed over signed plus refused or expired this month, as a whole percent; null when nothing closed this month. */
  winRate: number | null;
  /** The In progress stage: how many, the average visits a year of the priced ones (one decimal), and how many sites. */
  inProgress: { count: number; averageVisits: number | null; siteCount: number };
};

/** The day of the month in a `YYYY-MM-DD` business day; 0 when the text is not one (nothing then counts as this month). */
function dayOfMonth(today: string): number {
  const match = /^\d{4}-\d{2}-(\d{2})$/.exec(today);
  return match ? Number(match[1]) : 0;
}

/**
 * The four figures at the top of the Pipeline. A card's `ageDays` is the whole days since its last status change, so a
 * closed card with `ageDays` below the day of the month closed this month (the first of the month is day 1, age 0).
 */
export function pipelineStats(cards: PipelineCard[], today: string): PipelineStats {
  const open = cards.filter((card) => !isClosedStage(card.stage));
  const day = dayOfMonth(today);
  const closedThisMonth = cards.filter((card) => isClosedStage(card.stage) && card.ageDays < day);
  const signed = closedThisMonth.filter((card) => card.stage === "completed");

  const inProgress = cards.filter((card) => card.stage === "in_progress");
  const visits = inProgress.flatMap((card) => (card.visitsPerYear === undefined ? [] : [card.visitsPerYear]));

  return {
    openCents: open.reduce((sum, card) => sum + (card.annualCents ?? 0), 0),
    openCount: open.length,
    unpricedCount: open.filter((card) => card.annualCents === undefined).length,
    freshCount: open.filter((card) => card.ageDays < FRESH_UNDER_DAYS).length,
    followUpCount: cards.filter(needsFollowUp).length,
    signedCount: signed.length,
    signedCents: signed.reduce((sum, card) => sum + (card.annualCents ?? 0), 0),
    winRate: closedThisMonth.length === 0 ? null : Math.round((signed.length / closedThisMonth.length) * 100),
    inProgress: {
      count: inProgress.length,
      averageVisits: visits.length === 0 ? null : Math.round((visits.reduce((sum, value) => sum + value, 0) / visits.length) * 10) / 10,
      siteCount: new Set(inProgress.map((card) => card.site)).size,
    },
  };
}
