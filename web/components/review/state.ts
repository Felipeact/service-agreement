import type { PortalState } from "@/domain/portal";

/** What `decideAction` answers; `not_open` names the state the link is in now (customer-portal AC 21 to 24). */
export type DecideState =
  | { status: "idle" | "ok" | "unavailable" | "reason_required" | "reason_too_long" }
  | { status: "not_open"; state: PortalState };

/** What `recordViewAction` answers. The customer never sees it. */
export type RecordViewState = { status: "ok" | "unavailable" };

export const MAX_REASON = 2000;

/** The alert under the decision form for a state, or `null` when it needs none. `tenant` is the company's name. */
export function decideMessage(state: DecideState, tenant: string, typed: number): string | null {
  switch (state.status) {
    case "reason_required":
      return `Tell us why so ${tenant} can respond.`;
    case "reason_too_long":
      return `Keep it to ${MAX_REASON} characters or fewer. You typed ${typed}.`;
    case "not_open":
      return "This agreement can no longer be answered here. Reload the page to see where it stands.";
    case "unavailable":
      return "We couldn't send your answer. Try again.";
    default:
      return null;
  }
}
