"use client";

import { useActionState } from "react";
import { formatTermDate, termMonthsLabel, type AgreementTerm } from "@/domain/agreement";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { messageFor, type TermState } from "./state";

type TermSectionProps = {
  term: AgreementTerm;
  /** The save action of a writer on the current version of a draft; without it the term is read-only. */
  action?: (formData: FormData) => Promise<TermState>;
};

/** The term as staff read it: dates and length, or that the start is still missing (term-dates AC 8, 12). */
export function termSummary(term: AgreementTerm): string {
  if (term.start === null || term.end === null) return `Start date not set · ${termMonthsLabel(term.months)}`;
  return `Term: ${formatTermDate(term.start)} – ${formatTermDate(term.end)} · ${termMonthsLabel(term.months)}`;
}

const IDLE: TermState = { status: "idle" };

/** The Term section of the agreement page; writers set the start date and months of a draft here. */
export function TermSection({ term, action }: TermSectionProps) {
  const [state, formAction, pending] = useActionState<TermState, FormData>((_, formData) => (action ? action(formData) : Promise.resolve(IDLE)), IDLE);
  const values = state.status === "invalid" ? state.values : { start: term.start ?? "", months: String(term.months) };
  const errors = state.status === "invalid" ? state.errors : {};
  const message = messageFor(state.status);
  return (
    <section aria-label="Term" className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface px-4 py-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-[13px] font-semibold">Term</h2>
        <p data-term className="text-[13px] text-ink-2">
          {termSummary(term)}
        </p>
      </div>
      {action && (
        <form action={formAction} className="flex flex-col gap-3 md:flex-row md:items-end">
          <TextInput
            id="term-start"
            name="termStart"
            type="date"
            label="Start date"
            min="2000-01-01"
            max="2099-12-31"
            defaultValue={values.start}
            error={errors.start}
            className="md:w-48"
          />
          <TextInput
            id="term-months"
            name="termMonths"
            inputMode="numeric"
            label="Term (months)"
            defaultValue={values.months}
            error={errors.months}
            className="md:w-36"
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save term"}
          </Button>
        </form>
      )}
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </section>
  );
}
