"use client";

import { useState } from "react";
import Link from "next/link";
import * as motion from "motion/react-client";
import { TAP } from "@/components/motion/variants";
import { ANNUAL_DISCOUNT_PERCENT, EXTRA_SEAT_CENTS, MAX_SEATS, PLANS, PLAN_KEYS, formatPlanPrice, intervalCents, monthlyTotalCents, perMonthCents, seatsAfterPlanChange, type BillingInterval, type PlanKey } from "@/domain/billing";
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

const planOf = (key: PlanKey) => PLANS.find((plan) => plan.key === key)!;

/** A plan row: ringed in blue while it is the chosen one, as in the mockup. */
const planLabel = (isChosen: boolean) =>
  isChosen
    ? "flex items-center justify-between border-2 border-blue-600 bg-blue-50/30 rounded-xl p-4 cursor-pointer shadow-xs relative"
    : "flex items-center justify-between border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:bg-slate-50/70 transition";

/** One side of the monthly/annual switch: white while chosen, and at least 44px tall so a thumb can hit it. */
const intervalLabel = (isChosen: boolean) =>
  `flex flex-1 items-center justify-center min-h-11 px-4 py-1.5 rounded-lg text-xs cursor-pointer transition-all has-focus-visible:ring-2 has-focus-visible:ring-blue-500 ${isChosen ? "font-bold bg-white text-slate-900 shadow-xs" : "font-medium text-slate-500 hover:text-slate-900"}`;

const MESSAGE = "rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700";

type RegisterFieldsProps = {
  state: PricingState;
  pending: boolean;
  /** The plan carried over from the pricing page (`/register?plan=team`); the radio starts on it. */
  initialPlan?: PlanKey;
  /** The billing interval carried over from the pricing page (`/register?billing=annual`). */
  initialInterval?: BillingInterval;
  action?: (formData: FormData) => void;
};

/**
 * The register form from the owner's mockup (docs/service_pacts_register): who is signing up, the trades, the plan and its
 * seats, and the button that starts the trial. The markup and copy are the mockup's; the fields carry the names the
 * `startTrialAction` reads, and a refusal is shown at the top with the visitor's own values kept.
 */
export function RegisterFields({ state, pending, initialPlan = "team", initialInterval = "month", action }: RegisterFieldsProps) {
  const refused = state.status === "idle" ? null : state;
  const values = refused?.values;
  const fields = refused?.fields ?? {};
  const ticked: string[] = refused?.trades ?? [];

  const [plan, setPlan] = useState<PlanKey>(() => PLAN_KEYS.find((key) => key === values?.plan) ?? initialPlan);
  const [seats, setSeats] = useState<string>(() => values?.seats || String(planOf(PLAN_KEYS.find((key) => key === values?.plan) ?? initialPlan).includedSeats));
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const isAnnual = interval === "year";
  const chosen = planOf(plan);
  /** The plan row's price line: the monthly equivalent, and how it is billed. */
  const priceOf = (key: PlanKey) => formatPlanPrice(perMonthCents(planOf(key).monthlyCents, interval));
  const billedOf = (key: PlanKey) => (isAnnual ? `billed ${formatPlanPrice(intervalCents(planOf(key).monthlyCents, "year"))} yearly` : "billed monthly");
  const seatCount = /^[0-9]{1,3}$/.test(seats.trim()) ? Number(seats.trim()) : NaN;

  const extra = Number.isInteger(seatCount) && seatCount > chosen.includedSeats && seatCount <= MAX_SEATS ? seatCount - chosen.includedSeats : 0;

  const pickPlan = (next: PlanKey) => {
    setSeats(String(Number.isInteger(seatCount) ? seatsAfterPlanChange(plan, next, seatCount) : planOf(next).includedSeats));
    setPlan(next);
  };

  const messages: string[] = [];
  if (refused && (refused.status === "no_trade" || refused.status === "invalid_choice")) messages.push(REFUSALS[refused.status]);
  if (refused && (refused.status === "not_configured" || refused.status === "unavailable")) messages.push(REFUSALS[refused.status]);
  const companyMessage = refused?.status === "company_in_use" ? "A workspace with this company name already exists. Sign in, or ask its owner to invite you." : FIELD_REFUSALS.company;

  return (
    <form
      // A new key remounts the form on every result, so a refusal shows the visitor's own values (React resets a form after an action).
      key={`${state.status}:${JSON.stringify(values ?? {})}`}
      action={action}
      noValidate
      className="space-y-8"
    >
      {messages.map((message) => (
        <p key={message} role="alert" className={MESSAGE}>
          {message}
        </p>
      ))}
<div className="space-y-4"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600 text-[20px]">person</span><span>Who is signing up?</span></h2><span className="text-xs font-medium text-slate-400">Step 1 of 4</span></div><div className="space-y-3.5"><div><label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="work-email">Work email{" "}<span className="text-rose-500">*</span></label><div className="relative"><span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-[18px]">mail</span><input className="w-full rounded-xl border border-slate-300 pl-10 pr-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs max-lg:min-h-11" id="work-email" name="email" aria-describedby={fields.email ? "register-email-message" : undefined} defaultValue={values?.email ?? ""} autoComplete="email" aria-invalid={fields.email ? true : undefined} placeholder="name@company.ca" type="email" /></div>{fields.email && (
              refused?.status === "email_in_use" ? (
                <p id="register-email-message" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
                  {EMAIL_IN_USE} <Link href="/login" className="underline">Sign in</Link>
                </p>
              ) : (
                <p id="register-email-message" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{FIELD_REFUSALS.email}</p>
              )
            )}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"><div><label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="company-name">Company name{" "}<span className="text-rose-500">*</span></label><div className="relative"><span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-[18px]">business</span><input className="w-full rounded-xl border border-slate-300 pl-10 pr-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs max-lg:min-h-11" id="company-name" name="company" aria-describedby={fields.company ? "register-company-message" : undefined} defaultValue={values?.company ?? ""} autoComplete="organization" aria-invalid={fields.company ? true : undefined} placeholder="e.g. Apex Mechanical" type="text" /></div>{fields.company && <p id="register-company-message" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{companyMessage}</p>}</div><div><label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="phone">Phone{" "}<span className="text-rose-500">*</span></label><div className="relative"><span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-[18px]">phone</span><input className="w-full rounded-xl border border-slate-300 pl-10 pr-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs max-lg:min-h-11" id="phone" name="phone" aria-describedby={fields.phone ? "register-phone-message" : undefined} defaultValue={values?.phone ?? ""} autoComplete="tel" aria-invalid={fields.phone ? true : undefined} placeholder="+1 (604) 555-0199" type="tel" /></div>{fields.phone && <p id="register-phone-message" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{FIELD_REFUSALS.phone}</p>}</div></div></div></div><div className="space-y-3 pt-2"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600 text-[20px]">construction</span><span>What does your business do?</span></h2><p className="text-xs text-slate-500 mt-0.5">Tick every trade you work in. We configure pre-built checklists for them.</p></div><span className="text-xs font-medium text-slate-400">Step 2 of 4</span></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1"><label className="group flex items-center justify-between border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all shadow-2xs"><div className="flex items-center gap-3"><input className="w-4 h-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox" name="trade" value="hvac" defaultChecked={refused ? ticked.includes("hvac") : true} /><div className="flex items-center gap-2"><span className="material-symbols-outlined text-slate-500 group-hover:text-blue-600 text-[18px]">hvac</span><span className="text-xs font-semibold text-slate-800">Heating and cooling</span></div></div><span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Popular</span></label><label className="group flex items-center justify-between border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all shadow-2xs"><div className="flex items-center gap-3"><input className="w-4 h-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox" name="trade" value="plumbing" defaultChecked={refused ? ticked.includes("plumbing") : false} /><div className="flex items-center gap-2"><span className="material-symbols-outlined text-slate-500 group-hover:text-blue-600 text-[18px]">plumbing</span><span className="text-xs font-semibold text-slate-800">{"Plumbing & Hydronics"}</span></div></div></label><label className="group flex items-center justify-between border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all shadow-2xs"><div className="flex items-center gap-3"><input className="w-4 h-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox" name="trade" value="electrical" defaultChecked={refused ? ticked.includes("electrical") : false} /><div className="flex items-center gap-2"><span className="material-symbols-outlined text-slate-500 group-hover:text-blue-600 text-[18px]">bolt</span><span className="text-xs font-semibold text-slate-800">Electrical Systems</span></div></div></label><label className="group flex items-center justify-between border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all shadow-2xs"><div className="flex items-center gap-3"><input className="w-4 h-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox" name="trade" value="other" defaultChecked={refused ? ticked.includes("other") : false} /><div className="flex items-center gap-2"><span className="material-symbols-outlined text-slate-500 group-hover:text-blue-600 text-[18px]">handyman</span><span className="text-xs font-semibold text-slate-800">Refrigeration / Other</span></div></div></label></div></div><div className="space-y-3 pt-2"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600 text-[20px]">verified</span><span>Your plan</span></h2><p className="text-xs text-slate-500 mt-0.5">Team is pre-selected for typical commercial crews. Switch anytime.</p></div><span className="text-xs font-medium text-slate-400">Step 3 of 4</span></div><div className="space-y-2.5 pt-1"><div role="radiogroup" aria-label="Billing interval" className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 w-full"><label className={intervalLabel(!isAnnual)}><input className="sr-only" name="interval" type="radio" value="month" checked={!isAnnual} onChange={() => setInterval("month")} /><span>Monthly</span></label><label className={`${intervalLabel(isAnnual)} gap-1.5`}><input className="sr-only" name="interval" type="radio" value="year" checked={isAnnual} onChange={() => setInterval("year")} /><span>Annual</span><span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">-{ANNUAL_DISCOUNT_PERCENT}%</span></label></div><label className={planLabel(plan === "starter")}><div className="flex items-center gap-3.5"><input className="w-4 h-4 border-slate-300 text-blue-600 focus:ring-blue-500" name="plan" type="radio" value="starter" checked={plan === "starter"} onChange={() => pickPlan("starter")} /><div><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-900">Starter</span><span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">Small Contractors</span></div><div className="text-[11px] text-slate-500 mt-0.5">15 live agreements · 10 AI imports a month · 2 seats included</div></div></div><div className="text-right pl-4"><div className="text-sm font-extrabold text-slate-900">{priceOf("starter")}{" "}<span className="text-xs font-normal text-slate-500">CAD</span></div><div className="text-[10px] text-slate-400">{billedOf("starter")}</div></div></label><label className={planLabel(plan === "team")}><div className="absolute -top-2.5 right-6 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase">Most Popular</div><div className="flex items-center gap-3.5"><input className="w-4 h-4 border-slate-300 text-blue-600 focus:ring-blue-500" name="plan" type="radio" value="team" checked={plan === "team"} onChange={() => pickPlan("team")} /><div><div className="flex items-center gap-2"><span className="text-xs font-bold text-blue-900">Team</span><span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-sm">Best Value</span></div><div className="text-[11px] text-slate-600 mt-0.5">60 live agreements · 40 AI imports a month · 5 seats included</div></div></div><div className="text-right pl-4"><div className="text-sm font-extrabold text-blue-700">{priceOf("team")}{" "}<span className="text-xs font-normal text-slate-500">CAD</span></div><div className="text-[10px] text-blue-600/80 font-medium">{billedOf("team")}</div></div></label><label className={planLabel(plan === "business")}><div className="flex items-center gap-3.5"><input className="w-4 h-4 border-slate-300 text-blue-600 focus:ring-blue-500" name="plan" type="radio" value="business" checked={plan === "business"} onChange={() => pickPlan("business")} /><div><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-900">Business</span><span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">{"Scale & Multi-trade"}</span></div><div className="text-[11px] text-slate-500 mt-0.5">200 live agreements · 120 AI imports a month · 10 seats included</div></div></div><div className="text-right pl-4"><div className="text-sm font-extrabold text-slate-900">{priceOf("business")}{" "}<span className="text-xs font-normal text-slate-500">CAD</span></div><div className="text-[10px] text-slate-400">{billedOf("business")}</div></div></label></div></div><div className="space-y-2 pt-2"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><label className="block text-xs font-bold text-slate-900 flex items-center gap-2" htmlFor="team-members"><span className="material-symbols-outlined text-blue-600 text-[18px]">group</span><span>{"Team members & seats"}</span></label><span className="text-xs font-medium text-slate-400">Step 4 of 4</span></div><div className="flex items-center gap-4 pt-1"><div className="relative w-36"><input className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs max-lg:min-h-11" id="team-members" name="seats" aria-invalid={fields.seats ? true : undefined} aria-describedby={fields.seats ? "register-seats-message" : undefined} max={MAX_SEATS} min={chosen.includedSeats} type="number" value={seats} onChange={(event) => setSeats(event.target.value)} /><div className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">seats</div></div><p className="text-xs text-slate-500"><strong>{chosen.includedSeats} seats included</strong> in the {chosen.name} plan. Each extra crew member is {formatPlanPrice(perMonthCents(EXTRA_SEAT_CENTS, interval))}/mo CAD.</p></div>{fields.seats && <p id="register-seats-message" role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{FIELD_REFUSALS.seats(chosen.includedSeats)}</p>}{extra > 0 && (
            <p className="text-xs text-slate-500">
              {formatPlanPrice(perMonthCents(chosen.monthlyCents, interval))} + {extra} extra {extra === 1 ? "seat" : "seats"} x {formatPlanPrice(perMonthCents(EXTRA_SEAT_CENTS, interval))} = {formatPlanPrice(perMonthCents(monthlyTotalCents(chosen, seatCount), interval))}
            </p>
          )}</div><div className="space-y-4 pt-4 border-t border-slate-100"><motion.button disabled={pending} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-[0.99] cursor-pointer" type="submit" whileTap={TAP}><span>{pending ? "Starting…" : "Continue to secure checkout"}</span><span className="material-symbols-outlined text-[18px]">arrow_forward</span></motion.button><div className="flex items-center justify-center gap-6 text-xs text-slate-500 pt-1"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-emerald-600 text-[16px]">lock</span><span>256-bit SSL encrypted</span></div><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-blue-600 text-[16px]">credit_card</span><span>{isAnnual ? "Card charged yearly" : "Card charged monthly"}</span></div><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-slate-400 text-[16px]">cancel</span><span>Cancel anytime</span></div></div><div className="text-[11px] text-center text-slate-500 leading-relaxed pt-1"><p>You will enter your payment method with Stripe Canada. Canadian provincial taxes applied where applicable.</p><p className="mt-1">By continuing you accept our{" "}<Link className="underline text-slate-700 hover:text-blue-600 font-medium" href="/terms">Terms of Service</Link>{" "}and{" "}<Link className="underline text-slate-700 hover:text-blue-600 font-medium" href="/privacy">Privacy Policy</Link>.</p></div></div></form>
  );
}
