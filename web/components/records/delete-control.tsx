"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "./record-form";
import type { DeleteState } from "./state";

type PromptProps = {
  /** "Delete contact" or "Delete asset". */
  label: string;
  /** What is being deleted, as the prompt names it. */
  name: string;
  confirming: boolean;
  pending: boolean;
  state: DeleteState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The delete action; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
};

/** Two steps: the first button only asks, and nothing is deleted until "Delete" is pressed. */
export function DeletePrompt({ label, name, confirming, pending, state, onStart, onCancel, action }: PromptProps) {
  return (
    <section className="flex max-w-xl flex-col gap-3 border-t border-hairline pt-5">
      {confirming ? (
        <form action={action} className="flex flex-col gap-3">
          <p className="text-[13px] font-medium text-ink">{`Delete ${name}? This can't be undone.`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button onClick={onStart}>{label}</Button>
        </div>
      )}
      <FormAlert status={state.status} />
    </section>
  );
}

type ControlProps = {
  label: string;
  name: string;
  action: (state: DeleteState, formData: FormData) => Promise<DeleteState>;
};

export function DeleteControl({ label, name, action }: ControlProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<DeleteState, FormData>(action, { status: "idle" });
  return (
    <DeletePrompt
      label={label}
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
