import type { PipelineStage } from "./index";

/** Stages where the deal is over: a signed contract or a customer-side ending. Nothing is left to chase. */
const CLOSED_STAGES: readonly PipelineStage[] = ["completed", "refused"];

export function isClosedStage(stage: PipelineStage): boolean {
  return CLOSED_STAGES.includes(stage);
}

/**
 * Days an open deal may sit in its stage before the estimator should follow it up.
 * A starting point, not a customer promise: tune it here and the board, its filter and its counts follow.
 */
export const FOLLOW_UP_AFTER_DAYS: Partial<Record<PipelineStage, number>> = {
  in_progress: 14,
  sent: 7,
  accepted: 7,
};

type FollowUpInput = { stage: PipelineStage; ageDays: number; attention?: string };

/**
 * What to chase on a card that has sat too long: "Idle for 19 days", "No reply in 9 days", "Unsigned for 12 days".
 * A card whose attention label already says what is waiting (changes requested, awaiting countersignature) keeps that
 * label for the accepted stage, because "unsigned" would be wrong once the customer has signed.
 */
export function followUpLabel({ stage, ageDays, attention }: FollowUpInput): string | null {
  const after = FOLLOW_UP_AFTER_DAYS[stage];
  if (after === undefined || ageDays < after) return null;
  if (stage === "accepted" && attention) return null;
  if (stage === "sent") return `No reply in ${ageDays} days`;
  if (stage === "accepted") return `Unsigned for ${ageDays} days`;
  return `Idle for ${ageDays} days`;
}

/** An open deal needs the estimator when it carries an attention label or has sat too long. */
export function needsFollowUp(card: FollowUpInput): boolean {
  if (isClosedStage(card.stage)) return false;
  return Boolean(card.attention) || followUpLabel(card) !== null;
}

/**
 * The order a column lists its cards: open stages put the longest-waiting deal first so nothing slips down the page;
 * closed stages keep the board's newest-change-first order.
 */
export function sortForColumn<T extends { stage: PipelineStage; ageDays: number }>(stage: PipelineStage, cards: readonly T[]): T[] {
  if (isClosedStage(stage)) return [...cards];
  return [...cards].sort((a, b) => b.ageDays - a.ageDays);
}
