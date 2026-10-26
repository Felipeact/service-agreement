import type { MemberRole } from "@/application/ports";
import type { FieldErrors } from "@/domain/records";

/** What a record form shows after a submit; `invalid` and the failures keep what was typed. */
export type RecordFormState<Input> =
  | { status: "idle" }
  | { status: "invalid"; errors: FieldErrors<keyof Input & string>; values: Input }
  | { status: "not_found" | "unavailable"; values: Input }
  | { status: "forbidden" };

export type DeleteState = { status: "idle" | "forbidden" | "not_found" | "in_use" | "unavailable" };

/** Owners, admins and estimators write customers, contacts, sites and assets (the RLS policies); RLS still decides. */
export function canWriteRecords(role: MemberRole): boolean {
  return role === "owner" || role === "admin" || role === "estimator";
}

export const RECORD_MESSAGES = {
  noAccess: "Only owners, admins and estimators can change customer records.",
  forbidden: "You don't have permission to change customer records.",
  not_found: "This record no longer exists.",
  unavailable: "We couldn't save your changes. Try again.",
  in_use: "This contact is a site contact. Choose another site contact for that site first.",
} as const;

export type RecordFormKind =
  | "new-customer"
  | "edit-customer"
  | "new-contact"
  | "edit-contact"
  | "new-site"
  | "edit-site"
  | "new-asset"
  | "edit-asset";

/** Where Cancel goes: the record page the form came from. */
export function cancelHrefFor(kind: RecordFormKind, ids: { customerId?: string; siteId?: string } = {}): string {
  if (kind === "new-customer") return "/customers";
  if (kind === "new-asset" || kind === "edit-asset") return `/sites/${ids.siteId}`;
  return `/customers/${ids.customerId}`;
}

/** The values a form shows: what was typed after a failed submit, otherwise the record's own. */
export function shownValues<Input>(state: RecordFormState<Input>, initial: Input): Input {
  return "values" in state ? state.values : initial;
}

export function fieldErrors<Input>(state: RecordFormState<Input>): FieldErrors<keyof Input & string> {
  return state.status === "invalid" ? state.errors : {};
}
