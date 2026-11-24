"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CircleIcon } from "lucide-react";
import { isReadyToSend, type ReadinessItem } from "@/domain/agreement/readiness";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { messageFor, type LinkState, type TermState } from "@/components/agreements/state";
import { LinkControls } from "./link-controls";

type Props = {
  number: string;
  items: ReadinessItem[];
  term: { start: string | null; months: number };
  recipient: string | null;
  words?: ItemWords;
  /** Saves the term (the same action as the Term section); the card's date field only sets the start. */
  saveTerm: (formData: FormData) => Promise<TermState>;
  send: (email?: string, confirmUncovered?: boolean, confirmStart?: boolean) => Promise<LinkState>;
};

/**
 * "Before you send" (approved by the owner, 2026-11-23): each thing a draft needs before it goes to the customer, ticked or open,
 * each linking to the section where it is fixed; the term start date can be set right here; and once everything is done the
 * send flow (confirm, email, lock) takes over the button.
 */
export function BeforeYouSend({ number, items, term, recipient, words = DEFAULT_ITEM_WORDS, saveTerm, send }: Props) {
  const [start, setStart] = useState(term.start ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const isReady = isReadyToSend(items);
  const firstOpen = items.find((item) => !item.done);

  function handleStart(value: string) {
    setStart(value);
    // A date field reports each keystroke; only a whole date is saved.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const formData = new FormData();
    formData.set("termStart", value);
    formData.set("termMonths", String(term.months));
    startSaving(async () => {
      const result = await saveTerm(formData).catch(() => ({ status: "unavailable" }) as TermState);
      setMessage(result.status === "saved" ? null : (messageFor(result.status) ?? "The start date could not be saved."));
    });
  }

  return (
    <section aria-label="Before you send" className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-5 shadow-card">
      <h2 className="text-[17px] font-bold tracking-tight">Before you send</h2>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.key} className="flex gap-2.5 text-[14px]">
            {item.done ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Done" /> : <CircleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" aria-label="To do" />}
            <a href={`#${item.target}`} className="-my-1.5 flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-control hover:bg-board lg:min-h-0">
              <span className="font-medium">{itemText(item.label, words)}</span>
              <span className="break-words text-[12px] text-ink-2">{itemText(item.detail, words)}</span>
            </a>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        Term starts
        <input
          type="date"
          min="2000-01-01"
          max="2099-12-31"
          value={start}
          onChange={(event) => handleStart(event.target.value)}
          aria-describedby={message ? "card-term-message" : undefined}
          className="min-h-11 rounded-control border border-hairline bg-surface px-3 text-[14px] focus:border-action focus:outline-none lg:min-h-9"
        />
      </label>
      {isSaving && (
        <p role="status" className="text-[12px] text-ink-2">
          Saving the start date…
        </p>
      )}
      {message && (
        <p id="card-term-message" role="alert" className="text-[12px] font-medium text-danger">
          {message}
        </p>
      )}
      {isReady ? (
        <LinkControls number={number} canSend recipient={recipient} send={send} words={words} />
      ) : (
        <button type="button" disabled className="min-h-11 cursor-not-allowed rounded-control bg-board px-4 text-[14px] font-semibold text-ink-2 lg:min-h-9">
          {firstOpen?.key === "term" && items.filter((item) => !item.done).length === 1 ? "Set the start date to send" : "Finish the open items to send"}
        </button>
      )}
    </section>
  );
}
