"use server";

import { revalidatePath } from "next/cache";
import { getContainer } from "@/composition";
import { portalViewState } from "@/application/use-cases";
import type { DecideState, RecordViewState } from "@/components/review/state";

const DECISIONS = ["accept", "refuse", "request_changes"] as const;

/**
 * The customer's answer. The token is the credential; nothing here asks who the visitor is. The page is refreshed after
 * a write or a stale call so it shows the state the link is in now (customer-portal AC 18 to 24).
 */
export async function decideAction(token: string, decision: string, reason: string): Promise<DecideState> {
  if (!(DECISIONS as readonly string[]).includes(decision)) return { status: "unavailable" };
  try {
    const { decidePortal } = await getContainer();
    const result = await decidePortal(token, decision as (typeof DECISIONS)[number], reason);
    if (result.ok) {
      revalidatePath(`/review/${token}`);
      return { status: "ok" };
    }
    if (result.code === "not_open") {
      revalidatePath(`/review/${token}`);
      return { status: "not_open", state: portalViewState(result.view) };
    }
    return { status: result.code };
  } catch (cause) {
    console.error(`Portal decision failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { status: "unavailable" };
  }
}

/** Records that the customer opened the link; the database writes it only the first time (AC 26, 27). */
export async function recordViewAction(token: string): Promise<RecordViewState> {
  try {
    const { recordPortalView } = await getContainer();
    await recordPortalView(token);
    return { status: "ok" };
  } catch (cause) {
    console.error(`Portal view record failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { status: "unavailable" };
  }
}
