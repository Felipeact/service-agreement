"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { monthsLabel } from "@/domain/agreement/cadence";
import { hasChanges, type ProposalLine, type ProposalRow } from "@/domain/agreement/proposal";
import { formatCadExact } from "@/lib/money";
import type { ApplyReviewState, ReviewState } from "@/components/agreements/state";

/** Message tables in the default word; `itemText` speaks them in the org's words where they show. */
const REVIEW_FAILURE: Record<Exclude<ReviewState["status"], "ready" | "idle">, string> = {
  forbidden: "You cannot change this agreement.",
  not_found: "This agreement could not be found.",
  locked: "This agreement can no longer be edited.",
  no_equipment: "Add equipment to the site before reviewing the agreement.",
  unavailable: "The review is not available right now. Try again in a moment.",
};

const APPLY_FAILURE: Record<Exclude<ApplyReviewState["status"], "applied" | "idle">, string> = {
  forbidden: "You cannot change this agreement.",
  not_found: "This agreement could not be found.",
  locked: "This agreement can no longer be edited.",
  invalid: "The suggestion no longer fits the equipment on site. Review again.",
  unavailable: "Some changes could not be saved. Review again and apply.",
};

const BADGE: Record<ProposalRow["kind"], { label: string; tone: string }> = {
  added: { label: "New", tone: "bg-violet-600 text-white" },
  changed: { label: "Changed", tone: "bg-violet-100 text-violet-800" },
  unchanged: { label: "Kept", tone: "bg-board text-ink-2" },
};

const visits = (months: readonly number[]) => `${monthsLabel(months)} · ${months.length} ${months.length === 1 ? "visit" : "visits"}/yr`;
const columns = "md:grid md:grid-cols-[minmax(0,3fr)_6rem_8rem_8rem] md:gap-x-3";

type ReviewActions = {
  review: () => Promise<ReviewState>;
  apply: (proposal: unknown) => Promise<ApplyReviewState>;
};

type ReviewContextValue = {
  state: ReviewState;
  applyState: ApplyReviewState;
  isReviewing: boolean;
  isApplying: boolean;
  handleReview: () => void;
  handleApply: () => void;
  handleDiscard: () => void;
};

const ReviewContext = createContext<ReviewContextValue | null>(null);
const useReview = () => useContext(ReviewContext);

/**
 * Holds one AI review of the whole agreement for the page: the header button starts it, the banner under the header says what
 * it found and offers "Apply all" / "Discard", and the Service lines panel shows the suggested lines in place. Without actions
 * (a reader, or a version that cannot change) it only renders its children.
 */
export function ReviewProvider({ actions, children }: { actions?: ReviewActions; children: ReactNode }) {
  const [state, setState] = useState<ReviewState>({ status: "idle" });
  const [applyState, setApplyState] = useState<ApplyReviewState>({ status: "idle" });
  const [isReviewing, startReview] = useTransition();
  const [isApplying, startApply] = useTransition();
  if (!actions) return <>{children}</>;

  const value: ReviewContextValue = {
    state,
    applyState,
    isReviewing,
    isApplying,
    handleReview() {
      setApplyState({ status: "idle" });
      startReview(async () => setState(await actions.review().catch(() => ({ status: "unavailable" }) as const)));
    },
    handleApply() {
      if (state.status !== "ready") return;
      const proposal = state.proposal;
      startApply(async () => {
        const result = await actions.apply(proposal).catch(() => ({ status: "unavailable" }) as const);
        setApplyState(result);
        if (result.status === "applied") setState({ status: "idle" });
      });
    },
    handleDiscard() {
      setState({ status: "idle" });
      setApplyState({ status: "idle" });
    },
  };
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

/** "Review with AI" in the agreement header: reviews the whole agreement. */
export function ReviewButton() {
  const review = useReview();
  if (!review) return null;
  return (
    <Button onClick={review.handleReview} disabled={review.isReviewing || review.isApplying} className="border-transparent bg-violet-600 text-white shadow-card hover:bg-violet-700">
      <SparklesIcon className="size-4" aria-hidden="true" />
      {review.isReviewing ? "Reviewing…" : "Review with AI"}
    </Button>
  );
}

/**
 * Under the header while a review runs or is open: what the AI found across the agreement, the yearly total before and after,
 * and "Apply all" / "Discard". The suggested lines themselves show in the Service lines panel.
 */
export function ReviewBanner() {
  const review = useReview();
  const words = useItemWords();
  if (!review) return null;
  const { state, applyState, isReviewing, isApplying } = review;
  const ready = state.status === "ready" ? state : null;
  const failure = state.status in REVIEW_FAILURE ? itemText(REVIEW_FAILURE[state.status as keyof typeof REVIEW_FAILURE], words) : null;
  const applyFailure = applyState.status in APPLY_FAILURE ? itemText(APPLY_FAILURE[applyState.status as keyof typeof APPLY_FAILURE], words) : null;

  if (isReviewing) {
    return (
      <p role="status" className="rounded-panel border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-800">
        Reviewing the whole agreement: equipment, service lines, visits, prices and term…
      </p>
    );
  }
  if (failure) {
    return (
      <p role="alert" className="rounded-panel border border-hairline bg-surface px-4 py-3 text-[13px] font-medium text-danger">
        {failure}
      </p>
    );
  }
  if (applyState.status === "applied") {
    return (
      <p role="status" className="rounded-panel border border-hairline bg-surface px-4 py-3 text-[13px] text-ink-2">
        {`Applied. The agreement now has ${applyState.lines} service ${applyState.lines === 1 ? "line" : "lines"}.`}
      </p>
    );
  }
  if (!ready) return null;

  const delta = ready.diff.totalToCents - ready.diff.totalFromCents;
  const changes = ready.diff.rows.filter((row) => row.kind !== "unchanged").length + ready.diff.removed.length;
  return (
    <section aria-label="AI review" className="flex flex-col gap-3 rounded-panel border border-violet-300 bg-violet-50 px-4 py-3 shadow-card">
      <div className="flex items-start gap-2">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-violet-900">AI review of this agreement</h2>
          <p className="text-[13px] text-violet-900">{ready.summary}</p>
          {ready.source === "standard" && <p className="text-[12px] font-medium text-attention-fg">Standard plan shown: the AI review could not run.</p>}
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-violet-800">Now, per year</dt>
          <dd className="font-semibold tabular-nums">{formatCadExact(ready.diff.totalFromCents)}</dd>
        </div>
        <div>
          <dt className="text-violet-800">Suggested, per year</dt>
          <dd className="font-semibold tabular-nums">{formatCadExact(ready.diff.totalToCents)}</dd>
        </div>
        <div>
          <dt className="text-violet-800">Changes to the service lines</dt>
          <dd className="font-semibold tabular-nums">{changes === 0 ? "None" : `${changes} · ${delta < 0 ? "−" : "+"}${formatCadExact(Math.abs(delta))} a year`}</dd>
        </div>
      </dl>
      {applyFailure && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {applyFailure}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {hasChanges(ready.diff) && (
          <Button variant="primary" onClick={review.handleApply} disabled={isApplying}>
            {isApplying ? "Applying…" : "Apply all"}
          </Button>
        )}
        <Button onClick={review.handleDiscard} disabled={isApplying}>
          Discard
        </Button>
        {hasChanges(ready.diff) && <p className="self-center text-[12px] text-violet-800">The suggested lines are highlighted under Service lines.</p>}
      </div>
    </section>
  );
}

/** A changed value: the old one struck through, then the new one. */
function Was({ isChanged, before, after }: { isChanged: boolean; before: string; after: string }) {
  if (!isChanged) return <>{after}</>;
  return (
    <>
      <span className="mr-1 text-ink-2 line-through decoration-ink-2/60">{before}</span>
      <span className="sr-only">now </span>
      <span className="font-semibold text-violet-800">{after}</span>
    </>
  );
}

/** One suggested line, in the same columns as the lines it would replace, tinted and badged. */
function SuggestedRow({ row }: { row: ProposalRow }) {
  const { line } = row;
  const before: ProposalLine | null = row.kind === "changed" ? row.before : null;
  const changed = (field: "description" | "visitMonths" | "costPerVisitCents") => row.kind === "changed" && row.fields.includes(field);
  return (
    <li className={`flex flex-col gap-1 border-l-4 px-4 py-3 ${row.kind === "unchanged" ? "border-transparent" : "border-violet-500 bg-violet-50"} ${columns}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[row.kind].tone}`}>{BADGE[row.kind].label}</span>
          <span className="min-w-0 break-words">
            <Was isChanged={changed("description")} before={before?.description ?? ""} after={line.description} />
          </span>
        </p>
        <p className="text-[12px] text-ink-2">{line.equipment.join(", ")}</p>
        {line.reason && <p className="text-[12px] text-violet-800">{line.reason}</p>}
      </div>
      <p className="text-[13px]">
        <Was isChanged={changed("visitMonths")} before={before ? visits(before.visitMonths) : ""} after={visits(line.visitMonths)} />
      </p>
      <p className="text-[13px] tabular-nums md:text-right">
        <Was isChanged={changed("costPerVisitCents")} before={before ? formatCadExact(before.costPerVisitCents) : ""} after={formatCadExact(line.costPerVisitCents)} />
        <span className="md:hidden"> a visit</span>
      </p>
      <p className="text-[13px] font-semibold tabular-nums md:text-right">
        {formatCadExact(line.annualCents)}
        <span className="font-normal md:hidden"> a year</span>
      </p>
    </li>
  );
}

/**
 * The Service lines panel. While a review is open its suggested lines replace the current ones here, tinted violet and badged
 * New, Changed (old values struck through) or Kept, with the lines it would remove and the old and new total. Otherwise it shows
 * the lines as they are.
 */
export function ReviewableLines({ children, footer, bare = false }: { children: ReactNode; footer: ReactNode; bare?: boolean }) {
  const review = useReview();
  const ready = review?.state.status === "ready" ? review.state : null;
  const delta = ready ? ready.diff.totalToCents - ready.diff.totalFromCents : 0;

  return (
    <div
      data-service-lines
      className={bare ? (ready ? "border-y-2 border-violet-300" : "") : `overflow-hidden rounded-panel border bg-surface shadow-card ${ready ? "border-violet-400 ring-2 ring-violet-200" : "border-hairline"}`}
    >
      {bare ? (
        ready && <p className="border-b border-violet-200 bg-violet-50 px-5 py-2 text-[13px] font-semibold text-violet-900">Suggested by the AI review. Apply all or Discard at the top of the page.</p>
      ) : (
        <h2 className="border-b border-hairline px-4 py-3 text-[15px] font-semibold tracking-tight">{ready ? "Service lines: suggested" : "Service lines"}</h2>
      )}
      {ready ? (
        <>
          <ul className="divide-y divide-hairline">
            {ready.diff.rows.map((row, index) => (
              <SuggestedRow key={`${row.kind}-${index}`} row={row} />
            ))}
          </ul>
          {ready.diff.removed.length > 0 && (
            <details className="border-t border-hairline bg-ground">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 text-[13px] font-medium text-danger">
                {`${ready.diff.removed.length} current ${ready.diff.removed.length === 1 ? "line" : "lines"} would be removed`}
              </summary>
              <ul className="divide-y divide-hairline border-t border-hairline">
                {ready.diff.removed.map((line, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-x-3 px-4 py-2 text-[13px] text-ink-2 line-through decoration-ink-2/60">
                    <span className="min-w-0 break-words">{line.description}</span>
                    <span className="tabular-nums">{`${visits(line.visitMonths)} · ${formatCadExact(line.costPerVisitCents)}`}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline px-4 py-3">
            <p className="text-[14px] font-semibold">
              Total per year <Was isChanged={delta !== 0} before={formatCadExact(ready.diff.totalFromCents)} after={formatCadExact(ready.diff.totalToCents)} />
            </p>
            <p className="text-[12px] text-ink-2">Before tax</p>
          </div>
        </>
      ) : (
        <>
          {children}
          {footer}
        </>
      )}
    </div>
  );
}
