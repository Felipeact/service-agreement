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

/** What `sendAgreementAction` and `reissueLinkAction` answer: the full link once, or why nothing was written. */
export type LinkState =
  | { status: "idle" | "no_lines" | "conflict" | Failure }
  | { status: "sent" | "reissued"; url: string };

/** The send and new-link alerts; `conflict` and `no_lines` say what to do next (customer-portal AC 2, 3). */
export const LINK_MESSAGES = {
  no_lines: "Add at least one service line before sending.",
  conflict: "This agreement was changed by someone else. Reload the page.",
  forbidden: "You don't have permission to send agreements.",
  not_found: "This agreement no longer exists.",
  unavailable: "We couldn't do that. Try again.",
} as const;

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

/** The alert for a send or new-link state, or `null` when it needs none. */
export function linkMessageFor(status: string): string | null {
  return status in LINK_MESSAGES ? LINK_MESSAGES[status as keyof typeof LINK_MESSAGES] : null;
}
