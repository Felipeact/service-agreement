"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { messageFor, type MoveState } from "./state";

function Alert({ state }: { state: MoveState }) {
  const message = messageFor(state.status);
  return message ? (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {message}
    </p>
  ) : null;
}

type WithdrawPromptProps = {
  number: string;
  confirming: boolean;
  pending: boolean;
  state: MoveState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The withdraw action, bound to the agreement; absent in tests that only render markup. */
  action?: () => void;
};

/** Two steps: "Withdraw" asks first and says what withdrawing does. */
export function WithdrawPrompt({ number, confirming, pending, state, onStart, onCancel, action }: WithdrawPromptProps) {
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">{`Withdraw ${number}? It leaves the pipeline and frees the site for a new agreement.`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              Withdraw
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button onClick={onStart}>Withdraw</Button>
        </div>
      )}
      <Alert state={state} />
    </div>
  );
}

export function WithdrawControl({ number, action }: { number: string; action: () => Promise<MoveState> }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<MoveState>(() => action(), { status: "idle" });
  return (
    <WithdrawPrompt
      number={number}
      confirming={confirming && state.status !== "withdrawn"}
      pending={pending}
      state={state}
      onStart={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      action={formAction}
    />
  );
}

type RevisePromptProps = {
  /** The version the button starts: the current one plus one. */
  nextVersion: number;
  pending: boolean;
  state: MoveState;
  /** The revise action, bound to the agreement; absent in tests that only render markup. */
  action?: () => void;
};

/** Not destructive (the current version is kept), so it acts at once and lands on the new draft. */
export function RevisePrompt({ nextVersion, pending, state, action }: RevisePromptProps) {
  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <Button type="submit" variant="primary" disabled={pending}>
          {`Start version ${nextVersion}`}
        </Button>
      </form>
      <Alert state={state} />
    </div>
  );
}

export function ReviseControl({ nextVersion, action }: { nextVersion: number; action: () => Promise<MoveState> }) {
  const [state, formAction, pending] = useActionState<MoveState>(() => action(), { status: "idle" });
  return <RevisePrompt nextVersion={nextVersion} pending={pending} state={state} action={formAction} />;
}
