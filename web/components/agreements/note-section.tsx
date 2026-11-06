"use client";

import { useActionState } from "react";
import { MAX_NOTE_LENGTH } from "@/domain/agreement";
import { Button } from "@/components/ui/button";
import { messageFor, type NoteState } from "./state";

type NoteSectionProps = {
  /** The note the current version has now, or `null`. */
  note: string | null;
  /** The save action of a writer on the current version of a draft. */
  action: (formData: FormData) => Promise<NoteState>;
};

const IDLE: NoteState = { status: "idle" };

/** The staff note of a draft version: why this version exists, shown in the versions list (versioning AC 4). */
export function NoteSection({ note, action }: NoteSectionProps) {
  const [state, formAction, pending] = useActionState<NoteState, FormData>((_, formData) => action(formData), IDLE);
  const value = state.status === "invalid" ? state.values.note : (note ?? "");
  const error = state.status === "invalid" ? state.errors.note : undefined;
  const message = messageFor(state.status);
  return (
    <section aria-label="Version note" className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface px-4 py-3">
      <h2 className="text-[13px] font-semibold">Version note</h2>
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="version-note" className="text-[13px] font-medium text-ink">
            Why this version exists
          </label>
          <textarea
            id="version-note"
            name="note"
            rows={3}
            defaultValue={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "version-note-error" : undefined}
            className={`w-full rounded-control border bg-surface px-3 py-2 text-[13px] text-ink ${error ? "border-danger" : "border-field"}`}
          />
          <p className="text-[12px] text-ink-2">Up to {MAX_NOTE_LENGTH} characters</p>
          {error && (
            <p id="version-note-error" className="text-[12px] font-medium text-danger">
              {error}
            </p>
          )}
        </div>
        <div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save note"}
          </Button>
        </div>
      </form>
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </section>
  );
}
