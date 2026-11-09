import { Button } from "@/components/ui/button";
import { PLANS, TRADES, formatPlanPrice, type PlanKey } from "@/domain/billing";
import type { PricingState } from "./state";

/** The refusal texts. The first two belong to the trades; the others are about starting at all. */
export const REFUSALS = {
  no_trade: "Choose at least one trade.",
  invalid_choice: "Choose a plan and your trades again.",
  not_configured: "Sign-up isn't open yet. Please check back soon.",
  unavailable: "We couldn't start sign-up. Try again in a minute.",
} as const;

const TRADES_ERROR_ID = "pricing-trades-error";

const choice =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control border border-hairline bg-surface px-3 text-[13px] font-medium text-ink has-[:checked]:border-action has-[:checked]:bg-action-tint lg:min-h-[34px]";

function Refusal({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} role="alert" className="rounded-control bg-attention-bg px-3 py-2.5 text-[13px] text-attention-fg">
      {children}
    </p>
  );
}

type PricingFieldsProps = {
  state: PricingState;
  pending: boolean;
  /** The plan whose button was pressed while `pending`; its button reads "Starting…". */
  pressedPlan: PlanKey | null;
  action?: (formData: FormData) => void;
  onPress?: (plan: PlanKey) => void;
};

/** The trades and the three plans as one form: each plan's button submits the plan and the ticked trades together. */
export function PricingFields({ state, pending, pressedPlan, action, onPress }: PricingFieldsProps) {
  const ticked = state.status === "idle" ? [] : state.trades;
  const tradesRefusal = state.status === "no_trade" || state.status === "invalid_choice" ? REFUSALS[state.status] : null;
  const startRefusal = state.status === "not_configured" || state.status === "unavailable" ? REFUSALS[state.status] : null;

  return (
    <form action={action} noValidate className="flex flex-col gap-8">
      <fieldset
        // A new key remounts the boxes, so a refusal shows the visitor's own ticks (React resets an uncontrolled form after an action).
        key={`${state.status}:${ticked.join(",")}`}
        className="flex flex-col gap-3"
        aria-describedby={tradesRefusal ? TRADES_ERROR_ID : undefined}
      >
        <legend className="mb-3 font-display text-[20px] leading-tight font-semibold tracking-tight">What does your business do?</legend>
        <p className="text-ink-2">Tick every trade you work in. We set up your workspace for them.</p>
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {TRADES.map((trade) => (
            <label key={trade.code} className={choice}>
              <input type="checkbox" name="trade" value={trade.code} defaultChecked={ticked.includes(trade.code)} className="size-4 shrink-0 accent-action" />
              {trade.label}
            </label>
          ))}
        </div>
        {tradesRefusal && <Refusal id={TRADES_ERROR_ID}>{tradesRefusal}</Refusal>}
      </fieldset>

      <section aria-labelledby="pricing-plans-heading" className="flex flex-col gap-3">
        <h2 id="pricing-plans-heading" className="font-display text-[20px] leading-tight font-semibold tracking-tight">
          Choose a plan
        </h2>
        {startRefusal && <Refusal>{startRefusal}</Refusal>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article key={plan.key} data-plan={plan.key} className="flex flex-col gap-5 rounded-panel border border-hairline bg-surface p-5 shadow-card">
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-[18px] font-semibold tracking-tight">{plan.name}</h3>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[34px] leading-none font-semibold tracking-tight">{formatPlanPrice(plan.monthlyCents)}</span>
                  <span className="text-ink-2">a month</span>
                </p>
              </div>
              <ul className="flex flex-col gap-2 border-t border-hairline pt-4 text-[13px]">
                <li>{plan.liveAgreements} live agreements</li>
                <li>{plan.aiImports} AI imports a month</li>
                <li>Unlimited seats</li>
              </ul>
              <Button
                type="submit"
                variant="primary"
                name="plan"
                value={plan.key}
                disabled={pending}
                aria-label={`Start 14-day trial, ${plan.name} plan`}
                onClick={() => onPress?.(plan.key)}
                className="mt-auto w-full"
              >
                {pending && pressedPlan === plan.key ? "Starting…" : "Start 14-day trial"}
              </Button>
            </article>
          ))}
        </div>
        <p className="max-w-[70ch] text-[12px] text-ink-2">
          Prices are in Canadian dollars. A live agreement is one in progress, or sent and waiting for the customer. An AI import reads a customer&apos;s list with AI.
        </p>
      </section>
    </form>
  );
}
