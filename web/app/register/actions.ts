"use server";

import { redirect } from "next/navigation";
import { getBillingContainer } from "@/composition";
import { knownTrades } from "@/domain/billing";
import type { PricingState } from "./state";

/** The visitor pressed a plan's button: `plan` is that button's value, `trade` is every ticked box (pricing-page S2). */
export async function startTrialAction(_previous: PricingState, formData: FormData): Promise<PricingState> {
  const plan = formData.get("plan");
  const trades = formData.getAll("trade");
  const { startTrial } = await getBillingContainer();
  const outcome = await startTrial({ plan, trades });
  // `redirect` throws, so it stays outside any try block.
  if (outcome.status === "redirect") redirect(outcome.url);
  return { status: outcome.status, trades: knownTrades(trades) };
}
