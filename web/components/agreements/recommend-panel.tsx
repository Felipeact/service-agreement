"use client";

import { useActionState } from "react";
import type { UncoveredType } from "@/domain/agreement";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { messageFor, type KeepState, type RecommendState } from "./state";

const RECOMMEND_MESSAGES: Record<string, string> = {
  no_equipment: "Add equipment to the site first, then recommend lines.",
};

/**
 * Shown on a draft while some equipment on the site has no service line: one button adds a recommended line per trade and
 * visit pattern (recommended-lines). The lines arrive tagged Recommended, priced from typical rates, for the estimator to
 * keep or edit.
 */
export function RecommendPanel({ uncovered, hasLines, recommend, words = DEFAULT_ITEM_WORDS }: { uncovered: UncoveredType[]; hasLines: boolean; recommend: () => Promise<RecommendState>; words?: ItemWords }) {
  const [state, action, pending] = useActionState<RecommendState>(recommend, { status: "idle" });
  const units = uncovered.reduce((sum, type) => sum + type.assetCount, 0);
  const message = state.status === "idle" || state.status === "recommended" ? null : (state.status in RECOMMEND_MESSAGES ? itemText(RECOMMEND_MESSAGES[state.status], words) : messageFor(state.status));

  return (
    <section aria-label="Recommended service lines" className="flex flex-col gap-3 rounded-panel border border-action/25 bg-action-tint px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 gap-3">
        <span aria-hidden="true" className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control bg-surface text-action shadow-card">
          <Icon name="spark" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">
            {hasLines ? itemText(`${uncovered.length} equipment ${uncovered.length === 1 ? "type has" : "types have"} no service line yet`, words) : "Start from a recommended plan"}
          </h2>
          <p className="text-[13px] text-ink-2">
            {itemText(
              `${units} ${units === 1 ? "unit" : "units"} on site: ${uncovered.map((type) => `${type.name} (${type.assetCount})`).join(", ")}. We group them by trade and visit months, with a typical price per visit. Review each line before sending.`,
              words,
            )}
          </p>
          {message && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {message}
            </p>
          )}
        </div>
      </div>
      <form action={action} className="shrink-0">
        <Button type="submit" variant="primary" disabled={pending} className="w-full sm:w-auto">
          <Icon name="spark" className="size-4" />
          {pending ? "Adding…" : "Add recommended lines"}
        </Button>
      </form>
    </section>
  );
}

/** The count of lines still tagged Recommended, and one press that keeps them all as they are. */
export function ReviewBar({ count, keepAll }: { count: number; keepAll?: () => Promise<KeepState> }) {
  const [state, action, pending] = useActionState<KeepState>(async () => (keepAll ? keepAll() : { status: "forbidden" }), { status: "idle" });
  const message = state.status === "idle" || state.status === "kept" ? null : messageFor(state.status);
  return (
    <div role="status" className="flex flex-col gap-2 border-b border-hairline bg-attention-bg px-4 py-3 text-[13px] text-attention-fg sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className="font-semibold">{`${count} recommended ${count === 1 ? "line" : "lines"} to review.`}</span> Prices are typical rates, not yours yet: keep or edit each before sending.
      </p>
      {keepAll && (
        <form action={action} className="flex shrink-0 flex-col gap-1">
          <Button type="submit" disabled={pending}>
            <Icon name="check" className="size-4" />
            Keep all as they are
          </Button>
          {message && (
            <span role="alert" className="font-medium text-danger">
              {message}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
