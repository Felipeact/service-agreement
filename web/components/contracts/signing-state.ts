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

/** When a party signed, in the tenant's time zone: `Nov 7, 2026, 2:14 PM` (signature-webhook AC 25; the house zone is America/Vancouver). */
export function formatSignedAt(at: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Vancouver", dateStyle: "medium", timeStyle: "short" }).format(at);
}

/** One signer's line on the signed contract: `Pat Lee · Nov 7, 2026, 2:14 PM · 203.0.113.9`, leaving out what was not recorded. */
export function signerLine(signer: { name: string; signedAt: Date | null; ip: string | null }): string {
  return [signer.name, signer.signedAt ? formatSignedAt(signer.signedAt) : null, signer.ip].filter(Boolean).join(" · ");
}
