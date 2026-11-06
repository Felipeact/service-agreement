import type { BeginSignatureFailure, SignatureFailure } from "@/application/ports";

/** What `sendForSignatureAction` answers (signature-provider AC 12). `sent` has nothing to show: the page re-reads the request. */
export type SendSignatureState = { status: "idle" | "sent" | BeginSignatureFailure | SignatureFailure };

/** The alert for each refusal; each says what to do next. */
export const SIGNING_MESSAGES = {
  rejected: "DocuSeal rejected the document.",
  unavailable: "DocuSeal could not be reached. Try again.",
  not_configured: "E-signature is not set up for this workspace.",
  forbidden: "Only an owner or an admin can send a contract for signature.",
  not_found: "This contract no longer exists.",
  not_pending: "This contract is no longer waiting for signatures.",
  parties_missing: "This contract has no recorded signer, so it cannot be sent.",
  invalid_name: "Enter your name, up to 120 characters.",
  already_open: "This contract was already sent for signature.",
} as const;

/** The alert for a state, or `null` when it needs none. */
export function signingMessageFor(status: string): string | null {
  return status in SIGNING_MESSAGES ? SIGNING_MESSAGES[status as keyof typeof SIGNING_MESSAGES] : null;
}
