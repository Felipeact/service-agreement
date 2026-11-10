"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { CardFormShell, CardUpdateButton } from "./billing-parts";
import { beginCardUpdate, completeCardUpdate } from "./card-flow";
import { BILLING_MESSAGES, type BillingActions } from "./state";

type Props = {
  /** The publishable key (safe in the browser), read on the server; `null` when not set. */
  publishableKey: string | null;
  actions?: Pick<BillingActions, "startCardUpdate" | "finishCardUpdate">;
};

/** The card is typed into Stripe's own field inside this form; nothing of ours ever sees a number (billing-page AC 18). */
function CardForm({ onDone, onCancel, finish }: { onDone: () => void; onCancel: () => void; finish: BillingActions["finishCardUpdate"] }) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || pending) return;
    setPending(true);
    setError(null);
    const result = await completeCardUpdate({
      confirm: async () => {
        const confirmed = await stripe.confirmSetup({ elements, redirect: "if_required" });
        if (confirmed.error) return { ok: false, message: confirmed.error.message ?? BILLING_MESSAGES.card };
        return { ok: true, setupIntentId: confirmed.setupIntent.id };
      },
      finish,
    });
    setPending(false);
    if (result.status === "saved") return onDone();
    setError(result.status === "stripe_error" ? result.message : result.status === "forbidden" ? BILLING_MESSAGES.forbidden : BILLING_MESSAGES.card);
  }

  return (
    <CardFormShell pending={pending || !stripe} error={error} onCancel={onCancel} onSubmit={submit}>
      <PaymentElement options={{ layout: "tabs" }} />
    </CardFormShell>
  );
}

export function CardUpdate({ publishableKey, actions }: Props) {
  const router = useRouter();
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);
  const [secret, setSecret] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!publishableKey || !stripePromise) return <p className="rounded-control bg-board px-4 py-3 text-[13px] text-ink-2">Card updates aren&apos;t set up yet</p>;

  async function open() {
    if (!actions || opening) return;
    setOpening(true);
    setNotice(null);
    const begun = await beginCardUpdate(actions.startCardUpdate);
    setOpening(false);
    if (begun.status === "ready") setSecret(begun.clientSecret);
    else setNotice(begun.status === "forbidden" ? BILLING_MESSAGES.forbidden : BILLING_MESSAGES.card);
  }

  if (secret && actions) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret: secret, appearance: { theme: "stripe" } }}>
        <CardForm
          finish={actions.finishCardUpdate}
          onCancel={() => setSecret(null)}
          onDone={() => {
            setSecret(null);
            router.refresh();
          }}
        />
      </Elements>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <CardUpdateButton pending={opening} onClick={open} />
      </div>
      {notice && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {notice}
        </p>
      )}
    </div>
  );
}
