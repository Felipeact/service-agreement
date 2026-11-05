"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { IMPORT_FORM_MESSAGES, type ReadState } from "./state";

const READ_MESSAGES = {
  forbidden: IMPORT_FORM_MESSAGES.forbidden,
  not_found: "This import no longer exists.",
  not_ready: IMPORT_FORM_MESSAGES.upload_failed,
  unavailable: IMPORT_FORM_MESSAGES.read_failed,
} as const;

type ReadControlState = ReadState | { status: "idle" };

type PromptProps = {
  pending: boolean;
  state: ReadControlState;
  /** The read action; absent in tests that only render markup. */
  action?: () => void;
};

/** "Read file" on a job whose read did not finish; the outcome shows on the job once the list re-reads. */
export function ReadFilePrompt({ pending, state, action }: PromptProps) {
  const message = state.status in READ_MESSAGES ? READ_MESSAGES[state.status as keyof typeof READ_MESSAGES] : null;
  return (
    <form action={action} className="flex flex-col gap-2">
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Reading…" : "Read file"}
        </Button>
      </div>
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </form>
  );
}

export function ReadFileControl({ action }: { action: () => Promise<ReadState> }) {
  const [state, formAction, pending] = useActionState<ReadControlState>(() => action(), { status: "idle" });
  return <ReadFilePrompt pending={pending} state={state} action={formAction} />;
}
