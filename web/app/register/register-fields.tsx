import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { EXTRA_SEAT_CENTS, MAX_SEATS, PLANS, PLAN_KEYS, TRADES, formatPlanPrice, monthlyTotalCents, seatsAfterPlanChange, type PlanKey } from "@/domain/billing";
import type { PricingState } from "./state";

/** The refusal texts. The first two belong to the choices; the others are about starting at all. */
export const REFUSALS = {
  no_trade: "Choose at least one trade.",
  invalid_choice: "Choose a plan and your trades again.",
  not_configured: "Sign-up isn't open yet. Please check back soon.",
  unavailable: "We couldn't start sign-up. Try again in a minute.",
} as const;

/** The messages under the contact fields (register-seats S1). The seat message names the chosen plan's lowest count. */
export const FIELD_REFUSALS = {
  email: "Enter a work email we can reach you on.",
  company: "Enter your company name.",
  phone: "Enter a phone number with area code.",
  seats: (included: number) => `Choose between ${included} and ${MAX_SEATS} team members.`,
} as const;

/** The refusal for an email that already belongs to an org (checkout-email-in-use). It names no role, org or count. */
export const EMAIL_IN_USE = "This email already has a workspace.";

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

/** A message under a field, announced with it; the field points at it with `aria-describedby`. */
function FieldMessage({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} role="alert" className="-mt-2 text-[12px] font-medium text-danger">
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

const planOf = (key: PlanKey) => PLANS.find((plan) => plan.key === key)!;

/** Step one of sign-up: who is buying, the trades, the plan and its seats, and one button that starts the trial. */
export function RegisterFields({ state, pending, initialPlan = "team", action }: RegisterFieldsProps) {
  const refused = state.status === "idle" ? null : state;
  const values = refused?.values;
  const fields = refused?.fields ?? {};
  const ticked = refused?.trades ?? [];

  const [plan, setPlan] = useState<PlanKey>(() => PLAN_KEYS.find((key) => key === values?.plan) ?? initialPlan);
  const [seats, setSeats] = useState<string>(() => values?.seats || String(planOf(PLAN_KEYS.find((key) => key === values?.plan) ?? initialPlan).includedSeats));

  const chosen = planOf(plan);
  const seatCount = /^[0-9]{1,3}$/.test(seats.trim()) ? Number(seats.trim()) : NaN;
  const extra = Number.isInteger(seatCount) && seatCount > chosen.includedSeats && seatCount <= MAX_SEATS ? seatCount - chosen.includedSeats : 0;

  const pickPlan = (next: PlanKey) => {
    setSeats(String(Number.isInteger(seatCount) ? seatsAfterPlanChange(plan, next, seatCount) : planOf(next).includedSeats));
    setPlan(next);
  };

  const tradesRefusal = refused && (refused.status === "no_trade" || refused.status === "invalid_choice") ? REFUSALS[refused.status] : null;
  const startRefusal = refused && (refused.status === "not_configured" || refused.status === "unavailable") ? REFUSALS[refused.status] : null;
  const describedBy = (field: keyof typeof fields, id: string) => (fields[field] ? id : undefined);

  return (
    <form action={action} noValidate className="flex flex-col gap-8">
      <fieldset
        // A new key remounts the boxes, so a refusal shows the visitor's own values (React resets an uncontrolled form after an action).
        key={`${state.status}:${JSON.stringify(values ?? {})}`}
        className="flex flex-col gap-4"
      >
        <legend className="mb-3 font-display text-[20px] leading-tight font-semibold tracking-tight">Who is signing up?</legend>
        <TextInput
          id="register-email"
          name="email"
          type="email"
          label="Work email"
          autoComplete="email"
          defaultValue={values?.email ?? ""}
          aria-invalid={fields.email ? true : undefined}
          aria-describedby={describedBy("email", "register-email-message")}
        />
        {fields.email &&
          (refused?.status === "email_in_use" ? (
            <p id="register-email-message" role="alert" className="-mt-2 text-[12px] font-medium text-danger">
              {EMAIL_IN_USE}{" "}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </p>
          ) : (
            <FieldMessage id="register-email-message">{FIELD_REFUSALS.email}</FieldMessage>
          ))}
        <TextInput
          id="register-company"
          name="company"
          label="Company name"
          autoComplete="organization"
          defaultValue={values?.company ?? ""}
          aria-invalid={fields.company ? true : undefined}
          aria-describedby={describedBy("company", "register-company-message")}
        />
        {fields.company && (
          <FieldMessage id="register-company-message">{refused?.status === "company_in_use" ? "A workspace with this company name already exists. Sign in, or ask its owner to invite you." : FIELD_REFUSALS.company}</FieldMessage>
        )}
        <TextInput
          id="register-phone"
          name="phone"
          type="tel"
          label="Phone"
          autoComplete="tel"
          defaultValue={values?.phone ?? ""}
          aria-invalid={fields.phone ? true : undefined}
          aria-describedby={describedBy("phone", "register-phone-message")}
        />
        {fields.phone && <FieldMessage id="register-phone-message">{FIELD_REFUSALS.phone}</FieldMessage>}
      </fieldset>

      <fieldset
        key={`trades:${refused?.status ?? "idle"}:${ticked.join(",")}`}
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
          {PLANS.map((option) => (
            <label key={option.key} className={`${choice} justify-between py-2`}>
              <span className="flex items-center gap-2.5">
                <input type="radio" name="plan" value={option.key} checked={plan === option.key} onChange={() => pickPlan(option.key)} className="size-4 shrink-0 accent-action" />
                <span className="font-semibold">{option.name}</span>
                <span className="text-ink-2">
                  {option.liveAgreements} live agreements, {option.aiImports} AI imports a month, {option.includedSeats} seats included
                </span>
              </span>
              <span className="font-semibold">{formatPlanPrice(option.monthlyCents)} a month</span>
            </label>
          ))}
        </div>
        <TextInput
          id="register-seats"
          name="seats"
          type="number"
          inputMode="numeric"
          label="Team members"
          min={chosen.includedSeats}
          max={MAX_SEATS}
          value={seats}
          onChange={(event) => setSeats(event.target.value)}
          aria-invalid={fields.seats ? true : undefined}
          aria-describedby={describedBy("seats", "register-seats-message")}
        />
        {fields.seats && <FieldMessage id="register-seats-message">{FIELD_REFUSALS.seats(chosen.includedSeats)}</FieldMessage>}
        {extra > 0 && (
          <p className="text-[13px] text-ink-2">
            {formatPlanPrice(chosen.monthlyCents)} + {extra} extra {extra === 1 ? "seat" : "seats"} x {formatPlanPrice(EXTRA_SEAT_CENTS)} ={" "}
            {formatPlanPrice(monthlyTotalCents(chosen, seatCount))}
          </p>
        )}
        <p className="text-[12px] text-ink-2">
          {chosen.includedSeats} seats are included. Each extra seat is {formatPlanPrice(EXTRA_SEAT_CENTS)} a month.
        </p>
      </fieldset>

      {startRefusal && <Refusal>{startRefusal}</Refusal>}
      <div className="flex flex-col gap-2">
        <Button type="submit" variant="primary" disabled={pending} className="w-full sm:w-fit">
          {pending ? "Starting…" : "Continue to secure checkout"}
        </Button>
        <p className="max-w-[60ch] text-[12px] text-ink-2">
          Next you enter your card with our payment provider. You are charged the plan price today, then monthly. Prices are in Canadian dollars.
        </p>
      </div>
    </form>
  );
}
