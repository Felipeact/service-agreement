import { cents, type Cents } from "@/domain/money";

/**
 * Identifiers Stripe metadata and, later, org rows carry (pricing-page door 2). Add to them; never rename one once a
 * tenant holds it. Display names are separate fields so copy can change freely.
 */
export const PLAN_KEYS = ["starter", "team", "business"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

/** The first three are `private.catalog_packs.pack` codes (AD-154); `other` is not a pack. */
export const TRADE_CODES = ["hvac", "plumbing", "electrical", "other"] as const;
export type TradeCode = (typeof TRADE_CODES)[number];

export type Plan = {
  key: PlanKey;
  name: string;
  monthlyCents: Cents;
  /** Agreements that may be live at once (draft, sent or changes requested; the plan-limits item defines the unit). */
  liveAgreements: number;
  /** AI imports a month. */
  aiImports: number;
  /** Seats the plan price covers; each one beyond costs `EXTRA_SEAT_CENTS` a month (register-seats door 1). */
  includedSeats: number;
};

/** One flat monthly price for every seat beyond a plan's included ones, in CAD cents (draft, decision 10). */
export const EXTRA_SEAT_CENTS = cents(1900);

/** The most seats a visitor can pick at sign-up; a larger team talks to us. */
export const MAX_SEATS = 50;

/** The draft price table from ROADMAP.md (decision 10: the price points still need the owner). One source for the page and, later, the limits. */
export const PLANS: readonly Plan[] = [
  { key: "starter", name: "Starter", monthlyCents: cents(7900), liveAgreements: 15, aiImports: 10, includedSeats: 2 },
  { key: "team", name: "Team", monthlyCents: cents(14900), liveAgreements: 60, aiImports: 40, includedSeats: 5 },
  { key: "business", name: "Business", monthlyCents: cents(29900), liveAgreements: 200, aiImports: 120, includedSeats: 10 },
];

export type Trade = { code: TradeCode; label: string };

/** The order the form offers them in and the order a selection is stored in. */
export const TRADES: readonly Trade[] = [
  { code: "hvac", label: "Heating and cooling" },
  { code: "plumbing", label: "Plumbing" },
  { code: "electrical", label: "Electrical" },
  { code: "other", label: "Other" },
];

/** What Checkout needs to start a trial (register-seats door 3): every field is required. */
export type CheckoutSelection = {
  plan: PlanKey;
  trades: TradeCode[];
  /** The total seats the buyer wants, never below the plan's included seats. */
  seats: number;
  email: string;
  company: string;
  phone: string;
};

/** The plan and trades alone: what the choice part of the form validates. */
export type PlanChoice = { plan: PlanKey; trades: TradeCode[] };

export type FieldErrors = Partial<Record<"email" | "company" | "phone" | "seats", true>>;

export type SelectionResult =
  | { ok: true; value: CheckoutSelection }
  | { ok: false; code: "no_trade" | "invalid_choice" | "invalid_details"; fields: FieldErrors };

/** What a form posted, before anything is trusted. */
export type SelectionInput = { plan: unknown; trades: readonly unknown[]; seats: unknown; email: unknown; company: unknown; phone: unknown };

const PRICE_FORMAT = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

/** A monthly price in whole Canadian dollars, `$49`. */
export function formatPlanPrice(monthly: Cents): string {
  return PRICE_FORMAT.format(monthly / 100);
}

const isPlanKey = (value: unknown): value is PlanKey => (PLAN_KEYS as readonly unknown[]).includes(value);
const isTradeCode = (value: unknown): value is TradeCode => (TRADE_CODES as readonly unknown[]).includes(value);

/** The known trades among `values`, once each, in `TRADE_CODES` order; anything else is left out. */
export function knownTrades(values: readonly unknown[]): TradeCode[] {
  return TRADE_CODES.filter((code) => values.includes(code));
}

/**
 * Validates the choice a form posted. An unknown plan or trade value is `invalid_choice` (a forged post, and it wins over
 * an empty trade list); a valid plan with no trade is `no_trade`.
 */
export function parseChoice(plan: unknown, trades: readonly unknown[]): { ok: true; value: PlanChoice } | { ok: false; code: "no_trade" | "invalid_choice" } {
  if (!isPlanKey(plan) || !trades.every(isTradeCode)) return { ok: false, code: "invalid_choice" };
  if (trades.length === 0) return { ok: false, code: "no_trade" };
  return { ok: true, value: { plan, trades: knownTrades(trades) } };
}

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^[0-9 +\-().]+$/;

/** The fields after the choice, validated and normalised: the email lowercased, text trimmed with inner whitespace collapsed. */
function parseDetails(plan: PlanKey | null, input: SelectionInput): { fields: FieldErrors; value: Pick<CheckoutSelection, "seats" | "email" | "company" | "phone"> } {
  const fields: FieldErrors = {};
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email.length === 0 || email.length > 254 || !EMAIL_SHAPE.test(email)) fields.email = true;
  const company = typeof input.company === "string" ? collapse(input.company) : "";
  if (company.length === 0 || company.length > 120) fields.company = true;
  const phone = typeof input.phone === "string" ? collapse(input.phone) : "";
  if (phone.length < 7 || phone.length > 20 || !PHONE_CHARS.test(phone)) fields.phone = true;
  const included = PLANS.find((candidate) => candidate.key === plan)?.includedSeats ?? 0;
  const seats = typeof input.seats === "string" && /^[0-9]{1,3}$/.test(input.seats.trim()) ? Number(input.seats.trim()) : typeof input.seats === "number" ? input.seats : NaN;
  if (!Number.isInteger(seats) || seats < Math.max(included, 1) || seats > MAX_SEATS) fields.seats = true;
  return { fields, value: { seats, email, company, phone } };
}

/**
 * Validates everything a register form posted. Field errors are all reported together, beside the choice code when the
 * plan or trades are wrong; `invalid_details` means only fields failed.
 */
export function parseCheckoutSelection(input: SelectionInput): SelectionResult {
  const choice = parseChoice(input.plan, input.trades);
  const details = parseDetails(choice.ok ? choice.value.plan : null, input);
  if (!choice.ok) return { ok: false, code: choice.code, fields: details.fields };
  if (Object.keys(details.fields).length > 0) return { ok: false, code: "invalid_details", fields: details.fields };
  return { ok: true, value: { ...choice.value, ...details.value } };
}

/** The seat count after the visitor picks another plan (register-seats AC 11). */
export function seatsAfterPlanChange(from: PlanKey, to: PlanKey, seats: number): number {
  const before = PLANS.find((plan) => plan.key === from)!.includedSeats;
  const after = PLANS.find((plan) => plan.key === to)!.includedSeats;
  return seats === before ? after : Math.max(seats, after);
}

/** The monthly total for a plan with `seats` seats, in cents. */
export function monthlyTotalCents(plan: Plan, seats: number): Cents {
  return cents(plan.monthlyCents + Math.max(0, seats - plan.includedSeats) * EXTRA_SEAT_CENTS);
}
