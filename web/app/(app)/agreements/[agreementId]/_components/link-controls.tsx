"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatTermDate } from "@/domain/agreement";
import { DEFAULT_ITEM_WORDS, itemText, type CompanyProblem, type ItemWords } from "@/domain/org-settings";
import { linkMessageFor, type LinkState } from "@/components/agreements/state";

const PROBLEM_WORDS: Record<CompanyProblem, string> = {
  legalName: "legal name",
  address: "address",
  phone: "phone number",
  unconfirmed: "details (save them once to confirm)",
};

function Alert({ state }: { state: LinkState }) {
  if (state.status === "company_unconfirmed") {
    return (
      <p role="alert" className="text-[13px] font-medium text-danger">
        {`Your company ${state.problems.map((problem) => PROBLEM_WORDS[problem]).join(", ")} ${state.problems.length === 1 && state.problems[0] !== "unconfirmed" ? "is missing or still a sample" : "need attention"}. Your customer sees these on every agreement. `}
        <Link href="/settings" className="inline-flex min-h-11 items-center underline underline-offset-2 lg:min-h-0">
          Fix it in Settings
        </Link>
      </p>
    );
  }
  const message = linkMessageFor(state.status);
  return message ? (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {message}
    </p>
  ) : null;
}

type PromptProps = {
  confirming: boolean;
  pending: boolean;
  state: LinkState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The action, bound to the agreement; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
};

type SendPromptProps = PromptProps & { number: string; recipient?: string | null; words?: ItemWords };

/** Two steps: "Send to customer" asks first and says what sending does (customer-portal AC 1). */
export function SendPrompt({ number, recipient = null, confirming, pending, state, onStart, onCancel, action, words = DEFAULT_ITEM_WORDS }: SendPromptProps) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="primary" onClick={onStart}>
          Send to customer
        </Button>
      </div>
      <Modal
        open={confirming}
        onClose={() => onCancel?.()}
        title={recipient ? `Send ${number} to ${recipient}?` : `Send ${number} to the customer?`}
        sub="It is emailed with your link. Its lines, scope and terms are locked."
      >
        <form action={action} className="flex flex-col gap-4">
          {state.status === "needs_confirmation" && (
            <div role="alert" className="flex flex-col gap-1 rounded-control border border-hairline bg-ground px-3 py-2 text-[13px]">
              <p className="font-medium">{itemText(`Not in this agreement: ${state.uncovered.length} equipment ${state.uncovered.length === 1 ? "type has" : "types have"} no service line.`, words)}</p>
              <p className="text-ink-2">{state.uncovered.map((type) => `${type.name} (${type.assetCount})`).join(", ")}</p>
              <p className="text-ink-2">Send anyway, or cancel and add them to a line first.</p>
              <input type="hidden" name="confirmUncovered" value="yes" />
            </div>
          )}
          {state.status === "needs_start_confirmation" && (
            <div role="alert" className="flex flex-col gap-1 rounded-control border border-hairline bg-ground px-3 py-2 text-[13px]">
              <p className="font-medium">{`The start date is ${formatTermDate(state.start)}, which is in the past.`}</p>
              <p className="text-ink-2">It prints on the agreement. Send anyway, or cancel and change the start date first.</p>
              <input type="hidden" name="confirmStart" value="yes" />
              <input type="hidden" name="confirmUncovered" value="yes" />
            </div>
          )}
          {!recipient && (
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Customer email
              <input
                type="email"
                name="email"
                required
                autoComplete="off"
                placeholder="name@company.com"
                className="min-h-11 rounded-control border border-field bg-ground px-3 text-[13px] lg:min-h-[34px]"
              />
            </label>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {state.status === "needs_confirmation" || state.status === "needs_start_confirmation" ? "Send anyway" : "Send"}
            </Button>
          </div>
        </form>
      </Modal>
      <Alert state={state} />
    </div>
  );
}

type LinkControlsProps = {
  number: string;
  /** Sending is offered on the current version of a draft. */
  canSend: boolean;
  /** The customer's contact email on file, or `null` when the sender has to give one. */
  recipient: string | null;
  words?: ItemWords;
  send: (email?: string, confirmUncovered?: boolean, confirmStart?: boolean) => Promise<LinkState>;
};

/** The send flow: the agreement goes to the customer by email; no link is shown to the sender. */
export function LinkControls({ number, canSend, recipient, send, words }: LinkControlsProps) {
  const [sending, setSending] = useState(false);
  const [sendState, sendAction, sendPending] = useActionState<LinkState, FormData | null>(async (_previous, formData) => {
    const typed = formData?.get("email");
    const result = await send(typeof typed === "string" ? typed : undefined, formData?.get("confirmUncovered") === "yes", formData?.get("confirmStart") === "yes");
    // A question, not a refusal: the prompt stays open with the list and a button that confirms.
    if (result.status === "needs_confirmation" || result.status === "needs_start_confirmation") setSending(true);
    return result;
  }, { status: "idle" });

  if (!canSend) return null;
  return (
    <SendPrompt
      number={number}
      recipient={recipient}
      words={words}
      confirming={sending}
      pending={sendPending}
      state={sendState}
      onStart={() => setSending(true)}
      onCancel={() => setSending(false)}
      action={(formData) => {
        setSending(false);
        sendAction(formData);
      }}
    />
  );
}
