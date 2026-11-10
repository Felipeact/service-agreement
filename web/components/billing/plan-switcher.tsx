"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PLANS, formatPlanPrice, type PlanKey } from "@/domain/billing";
import { formatInvoiceAmount } from "@/domain/billing/overview";
import { planChangeSummary } from "@/domain/billing/plan-change";
import { BILLING_MESSAGES, type BillingActions, type PlanChangeResult } from "./state";

type Props = {
  /** The plan on the subscription, or `null` when it cannot be told. */
  current: PlanKey | null;
  /** The seats the subscription has now: the plan's included seats plus the seat item's quantity. */
  seats: number;
  /** The trial's end as shown ("Nov 24, 2026") while `trialing`, else `null`. */
  trialEndsOn: string | null;
  /** Why the plans are listed without switch controls, or `null` when switching is allowed. */
  readOnlyReason: string | null;
  actions?: Pick<BillingActions, "changePlan">;
};

const NOTICES: Record<Exclude<PlanChangeResult["status"], "done">, string> = {
  forbidden: BILLING_MESSAGES.forbidden,
  same_plan: BILLING_MESSAGES.samePlan,
  failed: BILLING_MESSAGES.plan,
};

/** The plans with their price and seats, the current one marked, and a two-step switch (plan-change S1 to S3). */
export function PlanSwitcher({ current, seats, trialEndsOn, readOnlyReason, actions }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<PlanKey | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || !actions || pending) return;
    setPending(true);
    setNotice(null);
    let result: PlanChangeResult = { status: "failed" };
    try {
      result = await actions.changePlan(target);
    } catch {
      // the notice below is the answer
    }
    setPending(false);
    if (result.status === "done") {
      setTarget(null);
      router.refresh();
    } else setNotice(NOTICES[result.status]);
  }

  const summary = target && current ? planChangeSummary(current, target, seats) : null;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-hairline rounded-control border border-hairline">
        {PLANS.map((plan) => (
          <li key={plan.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="min-w-0 flex-1 basis-40 text-[13px] font-semibold text-ink">
              {plan.name}
              <span className="block text-[12px] font-normal text-ink-2">{`${formatPlanPrice(plan.monthlyCents)}/month · ${plan.includedSeats} seats included`}</span>
            </span>
            {plan.key === current ? (
              <span className="rounded-control bg-board px-2 py-0.5 text-[12px] font-medium text-ink-2">Current plan</span>
            ) : (
              !readOnlyReason &&
              current && (
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setNotice(null);
                    setTarget(plan.key);
                  }}
                >
                  {`Switch to ${plan.name}`}
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
      {readOnlyReason && <p className="text-[13px] text-ink-2">{readOnlyReason}</p>}
      {summary && (
        <form onSubmit={confirm} className="flex flex-col gap-3 rounded-control bg-board p-4">
          <p className="text-[13px] font-medium text-ink">{`Switch to ${summary.plan.name}? ${formatPlanPrice(summary.plan.monthlyCents)}/month.`}</p>
          <p className="text-[13px] text-ink-2">{`Included seats: ${summary.plan.includedSeats}. Extra seats: ${summary.extraSeats}.`}</p>
          <p className="text-[13px] text-ink-2">{`New monthly total: ${formatInvoiceAmount(summary.totalCents, "cad")}.`}</p>
          <p className="text-[13px] text-ink-2">{trialEndsOn ? `Nothing is charged until your trial ends on ${trialEndsOn}.` : "The change takes effect now and the difference is prorated."}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Switching…" : "Confirm switch"}
            </Button>
            <Button disabled={pending} onClick={() => setTarget(null)}>
              Keep my plan
            </Button>
          </div>
        </form>
      )}
      {notice && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {notice}
        </p>
      )}
    </div>
  );
}
