import { NEW_CHOICE, type NewAgreementField, type NewAgreementInput } from "@/domain/agreement/new-agreement";
import type { PlanLimitNotice } from "@/domain/billing/plan-limits";
import { itemText, type ItemWords } from "@/domain/org-settings";

export { NEW_CHOICE, type NewAgreementInput };

type Failure = "forbidden" | "not_found" | "unavailable";

/**
 * What `startAgreementAction` answers. `started` carries the ids so the dialog can upload the equipment list to the
 * site before opening the agreement. A refusal that came after the customer or site was created carries their ids, so
 * a second try reuses them instead of creating them twice.
 */
export type StartAgreementState =
  | { status: "idle" | Failure; customerId?: string; siteId?: string }
  | { status: "started"; agreementId: string; siteId: string }
  | { status: "invalid"; errors: Partial<Record<NewAgreementField, string>> }
  /** The database refused the chosen template version; the ids are only those this call created, so a retry reuses them. */
  | { status: "invalid_template"; customerId?: string; siteId?: string }
  | { status: "open_exists"; agreementId: string; number: string }
  | ({ status: "plan_limit" } & PlanLimitNotice);

/** The dialog's own messages for a refusal; field errors are shown on their fields instead. */
export const START_MESSAGES = {
  forbidden: "You don't have permission to create agreements.",
  not_found: "That customer or site no longer exists. Close this and try again.",
  unavailable: "We couldn't create the agreement. Try again.",
  invalid_template: "That template is no longer available. Choose another.",
} as const;

/** A template the dialog offers: what it needs to name it, describe it and say what an agreement from it starts with. */
export type DialogTemplate = { versionId: string; name: string; description: string; presetLines: number; termMonths: number | null };

/** The Template choice's value for Standard agreement, which pins nothing. */
export const STANDARD_CHOICE = "";

export const STANDARD_NAME = "Standard agreement";

export const TEMPLATES_UNAVAILABLE = "Templates are unavailable. You can still start a standard agreement.";

/** The dialog's notice for a plan-limit refusal: the message, and a link to change plan for an owner or admin. */
export function startNotice(state: Extract<StartAgreementState, { status: "plan_limit" }>): { text: string; href?: string; linkText?: string } {
  return state.billingHref ? { text: state.message, href: state.billingHref, linkText: "Change plan" } : { text: state.message };
}

/** What the dialog says after the agreement exists but the equipment list could not be sent. */
export const LIST_FAILED = "The agreement was created, but we couldn't read the equipment list. You can add it from the agreement's site.";

export const FILE_HINT = "Excel, CSV, Word or PDF, up to 20 MB";

/** The dialog's start choice for a customer: the only customer when there is just one, otherwise none yet. */
export function firstCustomerChoice(customers: readonly { id: string }[]): string {
  return customers.length === 0 ? NEW_CHOICE : "";
}

export type Phase = "idle" | "creating" | "uploading" | "reading" | "extracting";

const PHASE_TEXT: Record<Exclude<Phase, "idle">, string> = {
  creating: "Creating the agreement…",
  uploading: "Sending the equipment list…",
  reading: "Reading the file…",
  extracting: "Finding the equipment…",
};

/** The progress line under the form, in the org's words ("Finding the stations… 2 of 5"). */
export function phaseLine(phase: Phase, progress: { done: number; total: number } | null, words: ItemWords): string {
  if (phase === "idle") return "";
  const text = phase === "extracting" && progress ? `${PHASE_TEXT.extracting} ${progress.done} of ${progress.total}` : PHASE_TEXT[phase];
  return itemText(text, words);
}
