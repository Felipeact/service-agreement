"use client";

import { useState, useTransition } from "react";
import { formatTermDate } from "@/domain/agreement/term";
import { messageFor, type TermState } from "@/components/agreements/state";
import { StaleStartNotice } from "./stale-start-notice";
import { field } from "./styles";

/**
 * The Term section's body (approved design): Starts and Months, saved as they change, and one sentence saying what that means.
 * Without an action (a reader, or a version that cannot change) only the sentence shows.
 */
export function TermFields({ term, action }: { term: { start: string | null; months: number }; action?: (formData: FormData) => Promise<TermState> }) {
  const [start, setStart] = useState(term.start ?? "");
  const [months, setMonths] = useState(String(term.months));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(nextStart: string, nextMonths: string) {
    if (!action || !/^\d{4}-\d{2}-\d{2}$/.test(nextStart) || !/^\d{1,2}$/.test(nextMonths)) return;
    const formData = new FormData();
    formData.set("termStart", nextStart);
    formData.set("termMonths", nextMonths);
    startTransition(async () => {
      const result = await action(formData).catch(() => ({ status: "unavailable" }) as TermState);
      setMessage(result.status === "saved" ? null : result.status === "invalid" ? Object.values(result.errors).filter(Boolean).join(" ") : (messageFor(result.status) ?? "The term could not be saved."));
    });
  }

  const sentence = term.start
    ? `Runs ${term.months} ${term.months === 1 ? "month" : "months"} from ${formatTermDate(term.start)}.`
    : "The customer page and the PDF print the start date, so it is needed before sending.";

  if (!action) return <p className="px-5 py-4 text-[13px] text-ink-2">{term.start ? sentence : `${term.months} months, start date not set.`}</p>;
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Starts
          <input
            type="date"
            name="termStart"
            min="2000-01-01"
            max="2099-12-31"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              save(event.target.value, months);
            }}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Months
          <input
            name="termMonths"
            inputMode="numeric"
            value={months}
            onChange={(event) => setMonths(event.target.value.replace(/\D/g, "").slice(0, 2))}
            onBlur={() => save(start, months)}
            className={`w-24 tabular-nums ${field}`}
          />
        </label>
        <p className="text-[13px] text-ink-2 sm:pb-2" aria-live="polite">
          {isPending ? "Saving…" : sentence}
        </p>
      </div>
      <StaleStartNotice start={start} />
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
