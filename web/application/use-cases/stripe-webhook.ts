import type { InvitationLinkSender, ReceiveStripeEventResult, StripeEvents } from "@/application/ports";

const OUTCOMES = ["recorded", "duplicate", "ignored"] as const;

/**
 * One Stripe delivery (billing-checkout Flow, webhook hops 2 and 3). The database verifies the signature and keeps the event
 * once. A refusal of the signature or the body is a value; a missing secret, an answer this code does not know, or any failure
 * is `unavailable`, which the route answers with `503` so Stripe retries. When the database says it created a workspace, the owner's
 * sign-in link is requested once, best effort (workspace-provisioning Flow hop 5): a failure is logged by its code and never changes
 * the answer, because the org already exists and the owner can ask for a link at `/login`.
 */
export function makeReceiveStripeEvent(events: StripeEvents, links?: InvitationLinkSender) {
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
    if (!outcome) return { ok: false, code: "unavailable" };
    if (answer.provisionedEmail && links) await sendOwnerLink(links, answer.provisionedEmail);
    return { ok: true, outcome };
  };
}

async function sendOwnerLink(links: InvitationLinkSender, email: string): Promise<void> {
  try {
    const sent = await links.send(email);
    if (!sent.ok) console.error(`Owner sign-in link failed: ${sent.code}`);
  } catch (cause) {
    // The name only: an error message can quote the address.
    console.error(`Owner sign-in link failed: ${cause instanceof Error ? cause.name : "a non-error"}`);
  }
}
