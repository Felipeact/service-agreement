import { Button } from "@/components/ui/button";
import { PLANS, TRADES, formatPlanPrice, type PlanKey } from "@/domain/billing";
import type { PricingState } from "./state";

/** The refusal texts. The first two belong to the choices; the others are about starting at all. */
export const REFUSALS = {
  no_trade: "Choose at least one trade.",
  invalid_choice: "Choose a plan and your trades again.",
  not_configured: "Sign-up isn't open yet. Please check back soon.",
  unavailable: "We couldn't start sign-up. Try again in a minute.",
} as const;

const TRADES_ERROR_ID = "register-trades-error";

const choice =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control border border-hairline bg-surface px-3 text-[13px] font-medium text-ink has-[:checked]:border-action has-[:checked]:bg-action-tint lg:min-h-[34px]";

function Refusal({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} role="alert" className="rounded-control bg-attention-bg px-3 py-2.5 text-[13px] text-attention-fg">
      {children}
    </p>
  );
}

type RegisterFieldsProps = {
  state: PricingState;
  pending: boolean;
  /** The plan carried over from the pricing page (`/register?plan=team`); the radio starts on it. */
  initialPlan?: PlanKey;
  action?: (formData: FormData) => void;
};

/** Step one of sign-up: the trades the business works in, the plan, and one button that starts the trial. */
export function RegisterFields({ state, pending, initialPlan = "team", action }: RegisterFieldsProps) {
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
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
          {TRADES.map((trade) => (
            <label key={trade.code} className={choice}>
              <input type="checkbox" name="trade" value={trade.code} defaultChecked={ticked.includes(trade.code)} className="size-4 shrink-0 accent-action" />
              {trade.label}
            </label>
          ))}
        </div>
        {tradesRefusal && <Refusal id={TRADES_ERROR_ID}>{tradesRefusal}</Refusal>}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-[20px] leading-tight font-semibold tracking-tight">Your plan</legend>
        <div className="flex flex-col gap-2">
          {PLANS.map((plan) => (
            <label key={plan.key} className={`${choice} justify-between py-2`}>
              <span className="flex items-center gap-2.5">
                <input type="radio" name="plan" value={plan.key} defaultChecked={plan.key === initialPlan} className="size-4 shrink-0 accent-action" />
                <span className="font-semibold">{plan.name}</span>
                <span className="text-ink-2">
                  {plan.liveAgreements} live agreements, {plan.aiImports} AI imports a month
                </span>
              </span>
              <span className="font-semibold">{formatPlanPrice(plan.monthlyCents)} a month</span>
            </label>
          ))}
        </div>
      </fieldset>

      {startRefusal && <Refusal>{startRefusal}</Refusal>}
      <div className="flex flex-col gap-2">
        <Button type="submit" variant="primary" disabled={pending} className="w-full sm:w-fit">
          {pending ? "Starting…" : "Continue to secure checkout"}
        </Button>
        <p className="max-w-[60ch] text-[12px] text-ink-2">
          Next you enter your email and card with our payment provider. You are not charged for 14 days. Prices are in Canadian dollars.
        </p>
      </div>
    </form>
  );
}
