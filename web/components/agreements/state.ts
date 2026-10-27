import type { ServiceLineErrors, ServiceLineInput } from "@/domain/agreement";

type Failure = "forbidden" | "not_found" | "unavailable";

/** What `createAgreementAction` answers when it does not redirect. */
export type CreateAgreementState = { status: "idle" | Failure } | { status: "open_exists"; agreementId: string; number: string };

/** What the three line actions answer; `invalid` keeps what was typed. */
export type LineState =
  | { status: "idle" | "saved" | "removed" | "too_many" | "locked" | Failure }
  | { status: "invalid"; errors: ServiceLineErrors; values: ServiceLineInput };

/** What `reviseAgreementAction` (when it does not redirect) and `withdrawAgreementAction` answer. */
export type MoveState = { status: "idle" | "withdrawn" | "conflict" | "invalid_transition" | Failure };

/** The agreement page's alerts, by state; each names what to do next. */
export const AGREEMENT_MESSAGES = {
  too_many: "An agreement version can have at most 50 lines.",
  locked: "This version can no longer be changed.",
  conflict: "This agreement changed meanwhile. Reload to see it.",
  invalid_transition: "This agreement can no longer do that. Reload to see it.",
  forbidden: "You don't have permission to change agreements.",
  not_found: "This agreement no longer exists.",
  unavailable: "We couldn't save this. Try again.",
} as const;

/** The alert for a state, or `null` when it needs none. */
export function messageFor(status: string): string | null {
  return status in AGREEMENT_MESSAGES ? AGREEMENT_MESSAGES[status as keyof typeof AGREEMENT_MESSAGES] : null;
}
