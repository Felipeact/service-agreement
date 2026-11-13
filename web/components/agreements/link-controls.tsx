"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { linkMessageFor, type LinkState } from "./state";

function Alert({ state }: { state: LinkState }) {
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

type SendPromptProps = PromptProps & { number: string; recipient?: string | null };

/** Two steps: "Send to customer" asks first and says what sending does (customer-portal AC 1). */
export function SendPrompt({ number, recipient = null, confirming, pending, state, onStart, onCancel, action }: SendPromptProps) {
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">
            {recipient ? `Email ${number} to ${recipient}? Its lines, scope and terms are locked.` : `Email ${number} to the customer? Its lines, scope and terms are locked.`}
          </p>
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
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              Send
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="primary" onClick={onStart}>
            Send to customer
          </Button>
        </div>
      )}
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
  send: (email?: string) => Promise<LinkState>;
};

/** The send flow: the agreement goes to the customer by email; no link is shown to the sender. */
export function LinkControls({ number, canSend, recipient, send }: LinkControlsProps) {
  const [sending, setSending] = useState(false);
  const [sendState, sendAction, sendPending] = useActionState<LinkState, FormData | null>(async (_previous, formData) => {
    const typed = formData?.get("email");
    return send(typeof typed === "string" ? typed : undefined);
  }, { status: "idle" });

  if (!canSend) return null;
  return (
    <SendPrompt
      number={number}
      recipient={recipient}
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
