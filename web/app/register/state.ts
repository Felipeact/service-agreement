import type { TradeCode } from "@/domain/billing";

/** What the pricing form shows after each submit. A refusal keeps the known trades the visitor ticked, so the boxes are not cleared. */
export type PricingState =
  | { status: "idle" }
  | { status: "no_trade" | "invalid_choice" | "not_configured" | "unavailable"; trades: TradeCode[] };

export const INITIAL_PRICING_STATE: PricingState = { status: "idle" };
