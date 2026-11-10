import type { FinishResult, StartResult } from "./state";

export type BeginResult = { status: "ready"; clientSecret: string } | { status: "failed" };

/** Step one of a card update: ask the server for a SetupIntent. A refusal or a throw is the failure state (billing-page AC 11). */
export async function beginCardUpdate(start: () => Promise<StartResult>): Promise<BeginResult> {
  try {
    const started = await start();
    return started.status === "ready" ? { status: "ready", clientSecret: started.clientSecret } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

export type CompleteResult = { status: "saved" } | { status: "stripe_error"; message: string } | { status: "failed" };

type Confirmed = { ok: true; setupIntentId: string } | { ok: false; message: string };

/**
 * Step two: Stripe's field confirms the card, then the server is told only the SetupIntent id (AC 12, 18). A Stripe error shows
 * Stripe's own message and nothing is sent to the server (AC 14); a refusal or a throw from the server is the card failure (AC 13).
 */
export async function completeCardUpdate(deps: { confirm: () => Promise<Confirmed>; finish: (setupIntentId: string) => Promise<FinishResult> }): Promise<CompleteResult> {
  const confirmed = await deps.confirm();
  if (!confirmed.ok) return { status: "stripe_error", message: confirmed.message };
  try {
    const finished = await deps.finish(confirmed.setupIntentId);
    return finished.status === "saved" ? { status: "saved" } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}
