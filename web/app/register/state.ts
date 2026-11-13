import type { FieldErrors, TradeCode } from "@/domain/billing";

/** What the visitor typed, kept so a refusal never clears the form. Text is as posted; `plan` is only a known plan key. */
export type RegisterValues = { plan: string; email: string; company: string; phone: string; seats: string };

/** What the register form shows after each submit. A refusal keeps the known trades ticked and every typed value. */
export type PricingState =
  | { status: "idle" }
  | { status: "no_trade" | "invalid_choice" | "invalid_details" | "email_in_use" | "company_in_use" | "not_configured" | "unavailable"; trades: TradeCode[]; values: RegisterValues; fields: FieldErrors };

export const INITIAL_PRICING_STATE: PricingState = { status: "idle" };
