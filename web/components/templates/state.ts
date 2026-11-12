import type { MemberRole } from "@/application/ports";
import type { TemplateFormErrors, TemplateFormInput } from "@/domain/agreement/template-form";

type Failure = "forbidden" | "not_found" | "unavailable";

/** What `saveAgreementTemplateAction` answers when it does not redirect; `invalid` keeps what was typed (agreement-templates AC 18). */
export type SaveTemplateState =
  | { status: "idle" | Failure }
  | { status: "invalid"; errors: TemplateFormErrors; values: TemplateFormInput };

/** What `duplicateTemplateAction` answers when it does not redirect to the copy's editor. */
export type DuplicateTemplateState = { status: "idle" | "name_taken" | Failure };

/** What `archiveTemplateAction` answers. */
export type ArchiveTemplateState = { status: "idle" | "archived" | Failure };

/** Owners and admins write templates (the two definer functions check it again, door 4). */
export function canWriteTemplates(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/** Estimators start agreements, so they use templates; a viewer only reads them (plan Assumptions). */
export function canUseTemplates(role: MemberRole): boolean {
  return role === "owner" || role === "admin" || role === "estimator";
}

export const TEMPLATE_MESSAGES = {
  forbidden: "Only owners and admins can change templates.",
  not_found: "That template no longer exists.",
  name_taken: "A template with that name already exists. Try again.",
  unavailable: "We couldn't do that. Try again.",
} as const;

export const NAME_TAKEN_FIELD_MESSAGE = "Another template already has this name. Choose a different one.";

/** The templates page when the list cannot be read (agreement-templates AC 22). */
export const LOAD_ERROR = "We couldn't load templates. Try again.";
