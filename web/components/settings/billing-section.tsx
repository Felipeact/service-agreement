"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { BillingSectionView } from "@/domain/billing/portal";

/** What the Billing section shows after pressing the button; a success never renders, the action redirects to Stripe. */
export type BillingFormState = { status: "idle" | "forbidden" | "unavailable" };

const NOTICES = {
  forbidden: "You don't have permission to change this",
  unavailable: "We couldn't open billing. Try again in a moment.",
} as const;

type BillingPanelProps = {
  view: BillingSectionView;
  state: BillingFormState;
  pending: boolean;
  action: () => void;
};

/** The Billing section's markup (billing-portal S1, S2, S3). */
export function BillingPanel({ view, state, pending, action }: BillingPanelProps) {
  if (view.kind === "hidden") return null;
  return (
    <section aria-labelledby="billing-title" className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="billing-title" className="font-display text-[18px] font-semibold tracking-tight">
          Billing
        </h2>
        <p className="text-[13px] text-ink-2">
          Your plan: <span className="font-semibold text-ink">{view.planName}</span>
        </p>
      </div>
      {view.kind === "unavailable" ? (
        <p className="rounded-control bg-board px-4 py-3 text-[13px] text-ink-2">Billing isn&apos;t available yet</p>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Opening…" : "Manage billing"}
          </Button>
          <p className="text-[13px] text-ink-2">Update your card, see invoices, change plan or cancel on Stripe&apos;s secure page.</p>
          {state.status !== "idle" && (
            <p role="alert" className="w-full text-[13px] font-medium text-danger">
              {NOTICES[state.status]}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

type BillingSectionProps = {
  view: BillingSectionView;
  action: (state: BillingFormState) => Promise<BillingFormState>;
};

/** The Billing section of Settings for an owner or admin of an org with a subscription. */
export function BillingSection({ view, action }: BillingSectionProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as BillingFormState);
  return <BillingPanel view={view} state={state} pending={pending} action={formAction} />;
}
