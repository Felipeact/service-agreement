import type { PlanLimitNotice } from "@/domain/billing/plan-limits";
import type { AgreementTermInput, ServiceLineErrors, ServiceLineInput, ServiceLineValue, UncoveredType } from "@/domain/agreement";
import type { ProposalDiff } from "@/domain/agreement/proposal";
import type { CompanyProblem } from "@/domain/org-settings";

type Failure = "forbidden" | "not_found" | "unavailable";

/** What `createAgreementAction` answers when it does not redirect. */
export type CreateAgreementState =
  | { status: "idle" | "invalid_template" | Failure }
  | { status: "open_exists"; agreementId: string; number: string }
  | ({ status: "plan_limit" } & PlanLimitNotice);

/** What `setAgreementTemplateAction` answers: the template was changed, or why not (`locked`: no longer a draft). */
export type TemplateState = { status: "idle" | "saved" | "locked" | "invalid_template" | Failure };

export const TEMPLATE_MESSAGES = {
  locked: "This agreement can no longer change its template.",
  invalid_template: "That template is no longer available. Reload the page.",
  forbidden: "You don't have permission to change agreements.",
  not_found: "This agreement no longer exists.",
  unavailable: "We couldn't change the template. Try again.",
} as const;

/** What `setScopeExclusionAction` answers: the change was saved, or why not (`locked`: no longer an editable draft). */
export type ScopeState = { status: "idle" | "saved" | "locked" | Failure };

export const SCOPE_MESSAGES = {
  locked: "This version can no longer be changed.",
  forbidden: "You don't have permission to change agreements.",
  not_found: "That item or agreement no longer exists.",
  unavailable: "We couldn't save this. Try again.",
} as const;

/** What the three line actions answer; `invalid` keeps what was typed. */
export type LineState =
  | { status: "idle" | "saved" | "removed" | "too_many" | "locked" | Failure }
  | { status: "invalid"; errors: ServiceLineErrors; values: ServiceLineInput };

/** What `saveTermAction` answers; `invalid` keeps what was typed (term-dates AC 9, 10). */
export type TermState =
  | { status: "idle" | "saved" | "locked" | Failure }
  | { status: "invalid"; errors: Partial<Record<keyof AgreementTermInput, string>>; values: AgreementTermInput };

/** What `saveVersionNoteAction` answers; `invalid` keeps what was typed (versioning AC 4). */
export type NoteState =
  | { status: "idle" | "saved" | "locked" | Failure }
  | { status: "invalid"; errors: { note?: string }; values: { note: string } };

/** What `reviseAgreementAction` (when it does not redirect) and `withdrawAgreementAction` answer. */
export type MoveState = { status: "idle" | "withdrawn" | "conflict" | "invalid_transition" | Failure };

/** What `sendAgreementAction` and `reissueLinkAction` answer: the full link once, or why nothing was written. */
export type LinkState =
  | { status: "idle" | "no_lines" | "no_term_start" | "conflict" | "needs_email" | "invalid_email" | Failure }
  | { status: "sent" | "reissued"; url: string }
  | { status: "company_unconfirmed"; problems: CompanyProblem[] }
  | { status: "needs_confirmation"; uncovered: UncoveredType[] }
  /** The start date is more than `STALE_START_DAYS` days before today; sending again with `confirmStart` sends anyway. */
  | { status: "needs_start_confirmation"; start: string };

/** The send and new-link alerts; `conflict` and `no_lines` say what to do next (customer-portal AC 2, 3). */
export const LINK_MESSAGES = {
  no_lines: "Add at least one service line before sending.",
  no_term_start: "Set the term start date before sending.",
  conflict: "This agreement was changed by someone else. Reload the page.",
  company_unconfirmed: "Confirm your company details in Settings before sending agreements.",
  needs_email: "Enter the customer's email so we can send the agreement.",
  invalid_email: "That email address doesn't look right. Check it and try again.",
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
  invalid_template: "That template is no longer available. Choose another one from Templates.",
} as const;

/** The alert for a state, or `null` when it needs none. */
export function messageFor(status: string): string | null {
  return status in AGREEMENT_MESSAGES ? AGREEMENT_MESSAGES[status as keyof typeof AGREEMENT_MESSAGES] : null;
}

/** The alert for a send or new-link state, or `null` when it needs none. */
export function linkMessageFor(status: string): string | null {
  return status in LINK_MESSAGES ? LINK_MESSAGES[status as keyof typeof LINK_MESSAGES] : null;
}

/** What `generateServiceLinesAction` answers: how many lines it added from the site's equipment (0 when every type was covered). */
export type GenerateLinesState = { status: "idle" | "forbidden" | "not_found" | "locked" | "unavailable" } | { status: "generated"; added: number };

/** What `reviewAgreementAction` answers: the suggested lines and what applying them changes, or why there are none. */
export type ReviewState =
  | { status: "idle" | "forbidden" | "not_found" | "locked" | "unavailable" | "no_equipment" }
  | { status: "ready"; source: "ai" | "standard"; summary: string; proposal: ServiceLineValue[]; diff: ProposalDiff };

/** What `applyReviewAction` answers. */
export type ApplyReviewState = { status: "idle" | "forbidden" | "not_found" | "locked" | "invalid" | "unavailable" } | { status: "applied"; lines: number };
