"use server";

import { redirect } from "next/navigation";
import { getBillingContainer } from "@/composition";
import { knownTrades } from "@/domain/billing";
import type { PricingState, RegisterValues } from "./state";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/** The visitor pressed the button: the plan, every ticked trade and the contact fields (pricing-page S2, register-seats S1). */
export async function startTrialAction(_previous: PricingState, formData: FormData): Promise<PricingState> {
  const plan = formData.get("plan");
  const trades = formData.getAll("trade");
  const values: RegisterValues = {
    plan: text(plan),
    email: text(formData.get("email")),
    company: text(formData.get("company")),
    phone: text(formData.get("phone")),
    seats: text(formData.get("seats")),
  };
  const { startTrial } = await getBillingContainer();
  const outcome = await startTrial({ plan, trades, seats: values.seats, email: values.email, company: values.company, phone: values.phone });
  // `redirect` throws, so it stays outside any try block.
  if (outcome.status === "redirect") redirect(outcome.url);
  return { status: outcome.status, trades: knownTrades(trades), values, fields: "fields" in outcome ? outcome.fields : {} };
}
