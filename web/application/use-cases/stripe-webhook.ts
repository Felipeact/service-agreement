import type { ReceiveStripeEventResult, StripeEvents } from "@/application/ports";

const OUTCOMES = ["recorded", "duplicate", "ignored"] as const;

/**
 * One Stripe delivery (billing-checkout Flow, webhook hops 2 and 3). The database verifies the signature and keeps the event
 * once. A refusal of the signature or the body is a value; a missing secret, an answer this code does not know, or any failure
 * is `unavailable`, which the route answers with `503` so Stripe retries.
 */
export function makeReceiveStripeEvent(events: StripeEvents) {
  return async function receiveStripeEvent(delivery: { body: string; signature: string }): Promise<ReceiveStripeEventResult> {
    let answer;
    try {
      answer = await events.receive(delivery);
    } catch (cause) {
      // The name only: a database message can quote a piece of the delivery.
      console.error(`Stripe webhook failed: ${cause instanceof Error ? cause.name : "a non-error"}`);
      return { ok: false, code: "unavailable" };
    }
    if (!answer.ok) return { ok: false, code: answer.code === "unconfigured" ? "unavailable" : answer.code };
    const outcome = OUTCOMES.find((known) => known === answer.outcome);
    return outcome ? { ok: true, outcome } : { ok: false, code: "unavailable" };
  };
}
