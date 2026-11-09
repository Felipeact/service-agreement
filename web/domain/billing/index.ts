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
};

/** The draft price table from ROADMAP.md (decision 10: the price points still need the owner). One source for the page and, later, the limits. */
export const PLANS: readonly Plan[] = [
  { key: "starter", name: "Starter", monthlyCents: cents(4900), liveAgreements: 15, aiImports: 10 },
  { key: "team", name: "Team", monthlyCents: cents(9900), liveAgreements: 60, aiImports: 40 },
  { key: "business", name: "Business", monthlyCents: cents(19900), liveAgreements: 200, aiImports: 120 },
];

export type Trade = { code: TradeCode; label: string };

/** The order the form offers them in and the order a selection is stored in. */
export const TRADES: readonly Trade[] = [
  { code: "hvac", label: "Heating and cooling" },
  { code: "plumbing", label: "Plumbing" },
  { code: "electrical", label: "Electrical" },
  { code: "other", label: "Other" },
];

export type CheckoutSelection = { plan: PlanKey; trades: TradeCode[] };

export type SelectionResult = { ok: true; value: CheckoutSelection } | { ok: false; code: "no_trade" | "invalid_choice" };

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
 * Validates what a form posted. An unknown plan or trade value is `invalid_choice` (a forged post, and it wins over
 * an empty trade list); a valid plan with no trade is `no_trade`.
 */
export function parseCheckoutSelection(plan: unknown, trades: readonly unknown[]): SelectionResult {
  if (!isPlanKey(plan) || !trades.every(isTradeCode)) return { ok: false, code: "invalid_choice" };
  if (trades.length === 0) return { ok: false, code: "no_trade" };
  return { ok: true, value: { plan, trades: knownTrades(trades) } };
}
