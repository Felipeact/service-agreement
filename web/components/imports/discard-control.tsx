"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { IMPORT_FORM_MESSAGES, type DiscardState } from "./state";

const DISCARD_MESSAGES = {
  forbidden: IMPORT_FORM_MESSAGES.forbidden,
  not_found: "This import no longer exists.",
  locked: "This import was already added to the site.",
  unavailable: "We couldn't discard the file. Try again.",
} as const;

type PromptProps = {
  /** The job's file name, as the prompt names it. */
  name: string;
  confirming: boolean;
  pending: boolean;
  state: DiscardState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The discard action; absent in tests that only render markup. */
  action?: () => void;
};

/** Two steps: the first button only asks, and nothing is deleted until "Discard" is pressed. */
export function DiscardPrompt({ name, confirming, pending, state, onStart, onCancel, action }: PromptProps) {
  const message = state.status in DISCARD_MESSAGES ? DISCARD_MESSAGES[state.status as keyof typeof DISCARD_MESSAGES] : null;
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">{`Discard ${name}? The file will be deleted.`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Discarding…" : "Discard"}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button onClick={onStart}>Discard</Button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

export function DiscardControl({ name, action }: { name: string; action: () => Promise<DiscardState> }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<DiscardState>(() => action(), { status: "idle" });
  return (
    <DiscardPrompt
      name={name}
      confirming={confirming}
      pending={pending}
      state={state}
      onStart={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      action={formAction}
    />
  );
}
