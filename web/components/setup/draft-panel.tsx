"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { IMPORT_ACCEPT } from "@/domain/imports";
import type { DraftType } from "@/domain/catalog-draft";
import { ACCEPT_MESSAGES, DRAFT_MESSAGES, type AcceptFormState, type DraftFormState } from "./draft-state";

const CARD = "flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type DraftPanelProps = {
  draftAction: (state: DraftFormState, formData: FormData) => Promise<DraftFormState>;
  acceptAction: (state: AcceptFormState, formData: FormData) => Promise<AcceptFormState>;
  /** Where the panel starts; only a test passes these. */
  initialDraft?: DraftFormState;
  initialPending?: boolean;
  initialAccept?: AcceptFormState;
};

/** The draft being reviewed in the browser: rename, remove, change months, remove tasks. Nothing here adds a type or a task (AC 14). */
function DraftReview({ trade, initial, acceptAction, initialAccept }: { trade: string; initial: DraftType[]; acceptAction: DraftPanelProps["acceptAction"]; initialAccept?: AcceptFormState }) {
  const [types, setTypes] = useState(() => initial.map((type, key) => ({ ...type, key })));
  const [state, formAction, pending] = useActionState(acceptAction, initialAccept ?? ({ status: "idle" } as AcceptFormState));
  const change = (key: number, edit: (type: DraftType) => DraftType) => setTypes((all) => all.map((type) => (type.key === key ? { ...edit(type), key } : type)));
  const payload = JSON.stringify(types.map(({ name, months, tasks }) => ({ name, months, tasks })));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="trade" value={trade} />
      <input type="hidden" name="types" value={payload} />
      <ul className="flex flex-col gap-4">
        {types.map((type) => (
          <li key={type.key} className="flex flex-col gap-3 rounded-control border border-hairline p-3">
            <div className="flex items-end gap-2">
              <TextInput
                id={`draft-name-${type.key}`}
                label="Type name"
                value={type.name}
                onChange={(event) => change(type.key, (t) => ({ ...t, name: event.target.value }))}
                className="grow"
              />
              <Button variant="secondary" aria-label={`Remove ${type.name}`} onClick={() => setTypes((all) => all.filter((t) => t.key !== type.key))}>
                Remove type
              </Button>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[13px] font-medium text-ink">Visit months</legend>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
                {MONTHS.map((label, index) => {
                  const month = index + 1;
                  const on = type.months.includes(month);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => change(type.key, (t) => ({ ...t, months: on ? t.months.filter((m) => m !== month) : [...t.months, month].sort((a, b) => a - b) }))}
                      className={`h-11 min-w-11 rounded-control border text-[12px] font-semibold lg:h-[34px] ${on ? "border-action bg-action text-surface" : "border-hairline bg-surface text-ink-2"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {type.tasks.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {type.tasks.map((task, position) => (
                  <li key={`${position}-${task}`} className="flex items-center justify-between gap-2 text-[13px] text-ink-2">
                    <span>{task}</span>
                    <Button variant="secondary" aria-label={`Remove task ${task}`} onClick={() => change(type.key, (t) => ({ ...t, tasks: t.tasks.filter((_, i) => i !== position) }))}>
                      Remove task
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-ink-2">
        This is a starting point drafted by an AI. You own these checklists, so read them before you add them.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending || types.length === 0}>
          {pending ? "Adding…" : "Add these to my catalog"}
        </Button>
        {state.status === "failed" && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {ACCEPT_MESSAGES[state.code]}
          </p>
        )}
      </div>
    </form>
  );
}

/**
 * The "Other" trade's way in (other-trade-draft): name the trade, optionally describe it or attach a proposal, read a Claude draft, edit
 * it and add it. The request is sent by hand so a failure leaves the file choice in the form as well as the text.
 */
export function DraftPanel({ draftAction, acceptAction, initialDraft, initialPending = false, initialAccept }: DraftPanelProps) {
  const [state, formAction, actionPending] = useActionState(draftAction, initialDraft ?? ({ status: "idle" } as DraftFormState));
  const [discarded, setDiscarded] = useState(false);
  const pending = actionPending || initialPending;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setDiscarded(false);
    startTransition(() => formAction(data));
  };
  const kept = state.status === "failed" ? state : { trade: "", notes: "" };

  if (state.status === "drafted" && !discarded) {
    return (
      <section aria-labelledby="draft-title" className={CARD}>
        <div className="flex flex-col gap-1">
          <h2 id="draft-title" className="font-display text-[18px] font-semibold tracking-tight">
            Review your draft
          </h2>
          <p className="text-[13px] text-ink-2">
            {state.types.length} {state.types.length === 1 ? "type" : "types"} for {state.trade}. Rename or remove what is wrong, then add the rest.
          </p>
        </div>
        <DraftReview trade={state.trade} initial={state.types} acceptAction={acceptAction} initialAccept={initialAccept} />
        <div>
          <Button variant="secondary" onClick={() => setDiscarded(true)}>
            Discard draft
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="draft-title" className={CARD}>
      <div className="flex flex-col gap-1">
        <h2 id="draft-title" className="font-display text-[18px] font-semibold tracking-tight">
          Draft your catalog
        </h2>
        <p className="text-[13px] text-ink-2">
          Tell us your trade and Claude drafts the types you service, with a checklist and visit months for each. Attach the proposal you send today, or describe your work in a few words.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextInput id="draft-trade" name="trade" label="Your trade" placeholder="Pest control" defaultValue={kept.trade} error={state.status === "failed" && state.code === "invalid" ? DRAFT_MESSAGES.invalid : undefined} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="draft-notes" className="text-[13px] font-medium text-ink">
            About your work (optional)
          </label>
          <textarea id="draft-notes" name="notes" maxLength={2000} rows={3} defaultValue={kept.notes} className="w-full rounded-control border border-field bg-surface px-3 py-2 text-[13px] text-ink" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="draft-file" className="text-[13px] font-medium text-ink">
            Your current proposal (optional)
          </label>
          <input id="draft-file" name="file" type="file" accept={IMPORT_ACCEPT} className="min-h-11 text-[13px] text-ink-2" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Drafting…" : state.status === "failed" && state.code === "unavailable" ? "Try again" : "Draft my catalog"}
          </Button>
          {pending && (
            <p role="status" className="text-[13px] text-ink-2">
              Claude is drafting your catalog. This can take up to a minute.
            </p>
          )}
          {state.status === "failed" && state.code !== "invalid" && !pending && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {DRAFT_MESSAGES[state.code]}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
