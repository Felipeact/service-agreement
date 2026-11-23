"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
      <ul className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.key === current;
          return (
            <li key={plan.key} className={`flex flex-col gap-3 rounded-card border p-4 ${isCurrent ? "border-action bg-action-tint ring-1 ring-action/30" : "border-hairline"}`}>
              <div className="flex items-center gap-2">
                <h3 className="mr-auto text-[16px] font-bold">{plan.name}</h3>
                {isCurrent && <span className="inline-flex h-[22px] items-center rounded-full bg-blue-100 px-2.5 text-[11px] font-semibold whitespace-nowrap text-action-press">Current plan</span>}
              </div>
              <p className="text-[26px] font-bold tracking-tight">
                {formatPlanPrice(plan.monthlyCents)}
                <span className="text-[13px] font-medium text-ink-2"> /month CAD</span>
              </p>
              <p className="text-[12px] text-ink-2">{`${plan.liveAgreements} live agreements · ${plan.includedSeats} seats included`}</p>
              {!isCurrent && !readOnlyReason && current && (
                <Button
                  variant="primary"
                  className="mt-auto"
                  disabled={pending}
                  onClick={() => {
                    setNotice(null);
                    setTarget(plan.key);
                  }}
                >
                  {`Switch to ${plan.name}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {readOnlyReason && <p className="text-[13px] text-ink-2">{readOnlyReason}</p>}
      {summary && (
        <Modal open onClose={() => setTarget(null)} title={`Switch to ${summary.plan.name}?`} sub={`${formatPlanPrice(summary.plan.monthlyCents)}/month.`}>
          <form onSubmit={confirm} className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-2">{`Included seats: ${summary.plan.includedSeats}. Extra seats: ${summary.extraSeats}.`}</p>
            <p className="text-[13px] text-ink-2">{`New monthly total: ${formatInvoiceAmount(summary.totalCents, "cad")}.`}</p>
            <p className="text-[13px] text-ink-2">{trialEndsOn ? `Nothing is charged until your trial ends on ${trialEndsOn}.` : "The change takes effect now and the difference is prorated."}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button disabled={pending} onClick={() => setTarget(null)}>
                Keep my plan
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Switching…" : "Confirm switch"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {notice && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {notice}
        </p>
      )}
    </div>
  );
}
