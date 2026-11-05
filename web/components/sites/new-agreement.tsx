"use client";

import Link from "next/link";
import { useActionState } from "react";
import { messageFor, type CreateAgreementState } from "@/components/agreements/state";
import { Button } from "@/components/ui/button";

type PromptProps = {
  state: CreateAgreementState;
  pending: boolean;
  /** The create action, bound to the site; absent in tests that only render markup. */
  action?: () => void;
};

/** "New agreement" needs no field: the site is the input. A live agreement found meanwhile is named with a link. */
export function NewAgreementPrompt({ state, pending, action }: PromptProps) {
  const message = state.status === "open_exists" ? null : messageFor(state.status);
  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "New agreement"}
        </Button>
      </form>
      {state.status === "open_exists" && (
        <p role="alert" className="text-[13px] font-medium text-ink">
          {`${state.number} is already in progress for this site.`}{" "}
          <Link href={`/agreements/${state.agreementId}`} className="inline-flex min-h-11 items-center text-action lg:min-h-0">
            {`Open ${state.number}`}
          </Link>
        </p>
      )}
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

export function NewAgreementControl({ action }: { action: () => Promise<CreateAgreementState> }) {
  const [state, formAction, pending] = useActionState<CreateAgreementState>(() => action(), { status: "idle" });
  return <NewAgreementPrompt state={state} pending={pending} action={formAction} />;
}
