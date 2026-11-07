import type { ContractStatus } from "./index";

/** Same values as the `contract_signature_requests.status` check (signature-provider door 2, signature-webhook door 2). */
export const SIGNATURE_REQUEST_STATUSES = ["creating", "open", "failed", "voided", "completed", "declined"] as const;

export type SignatureRequestStatus = (typeof SIGNATURE_REQUEST_STATUSES)[number];

/** A request being made or waiting for signatures: the contract cannot be sent again while one exists. */
export function isLiveRequest(status: SignatureRequestStatus): boolean {
  return status === "creating" || status === "open";
}

/** What `/sign/<token>` shows: the form, a thank-you, or the end of the road. */
export type SigningState = "open" | "signed" | "closed";

/**
 * One of three states from the request and the contract (signature-provider AC 18 to 20). A request that is `open` on a
 * contract past `pending_signature` says the customer has signed, or the contract ended; a request that is not `open` is closed.
 */
export function signingState(input: { requestStatus: SignatureRequestStatus; contractStatus: ContractStatus }): SigningState {
  if (input.requestStatus !== "open") return "closed";
  switch (input.contractStatus) {
    case "pending_signature":
      return "open";
    case "client_signed":
    case "completed":
      return "signed";
    default:
      return "closed";
  }
}

/** The address a customer opens to sign: `<base>/sign/<token>`, whatever trailing slashes the base carries (door 7). */
export function signingLinkUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/sign/${token}`;
}

/** The longest name a contractor signer can have (`begin_signature_request` refuses more, `23514` / `invalid_name`). */
export const SIGNER_NAME_MAX = 120;

/** The contractor signs for the company, so only an owner or an admin sends a contract for signature and countersigns it (assumption, signature-provider). */
export function canSignContracts(role: string): boolean {
  return role === "owner" || role === "admin";
}
