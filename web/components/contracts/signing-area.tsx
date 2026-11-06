"use client";

import { useActionState, useState } from "react";
import type { ContractStatus, SignatureRequestStatus } from "@/domain/contract";
import { canSignContracts, isLiveRequest, SIGNER_NAME_MAX } from "@/domain/contract";
import { Button } from "@/components/ui/button";
import { SigningForm } from "@/components/signing/signing-form";
import { signingMessageFor, type SendSignatureState } from "./signing-state";

export const WAITING_FOR_CUSTOMER = "Waiting for the customer to sign.";
export const NO_REQUEST_RECORDED = "No signature request was recorded for this contract.";

function Alert({ state }: { state: SendSignatureState }) {
  const message = signingMessageFor(state.status);
  return message ? (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {message}
    </p>
  ) : null;
}

type PromptProps = {
  /** The customer's signer from the contract's frozen parties, or `null` when none was recorded. */
  customer: { name: string; email: string } | null;
  /** The member's own email: the contractor signs with it. */
  memberEmail: string;
  confirming: boolean;
  pending: boolean;
  state: SendSignatureState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The send action, bound to the contract; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
};

/**
 * Two steps: "Send for signature" asks first and names both signers, because a request is a legal document in the
 * provider's hands (signature-provider AC 8). Nothing is created until the form is submitted.
 */
export function SendForSignaturePrompt({ customer, memberEmail, confirming, pending, state, onStart, onCancel, action }: PromptProps) {
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">Send this contract for signature? The customer signs first, then you.</p>
          <p className="text-[13px] text-ink-2">Customer signer: {customer ? `${customer.name} · ${customer.email}` : "No signer recorded."}</p>
          <p className="text-[13px] text-ink-2">You sign as: {memberEmail}</p>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Your name
            <input
              name="name"
              required
              maxLength={SIGNER_NAME_MAX}
              autoComplete="name"
              className="min-h-11 rounded-control border border-field bg-ground px-3 text-[13px] font-normal lg:min-h-[34px]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending || !customer}>
              Send for signature
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="primary" onClick={onStart}>
            Send for signature
          </Button>
        </div>
      )}
      <Alert state={state} />
    </div>
  );
}

type LinkPanelProps = { url: string; copied?: boolean; onCopy?: () => void };

/** The customer's signing address, for an owner or admin to copy until the emails of item 4 send it. */
export function SigningLinkPanel({ url, copied = false, onCopy }: LinkPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-ink-2">Give the customer&apos;s signer this link. It opens the contract for signature.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Customer signing link address"
          className="min-h-11 min-w-0 flex-1 rounded-control border border-field bg-ground px-3 text-[13px] lg:min-h-[34px]"
        />
        <Button variant="primary" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export type SigningAreaProps = {
  contractStatus: ContractStatus;
  /** The newest request, or `null` (the reader's `signing`). */
  request: { requestId: string; status: SignatureRequestStatus } | null;
  role: string;
  customer: { name: string; email: string } | null;
  memberEmail: string;
  /** The customer's `/sign/<token>` address, read only for an owner or admin with an open request. */
  customerLinkUrl: string | null;
  /** The contractor's embed address, read only for an owner or admin on a `client_signed` contract. */
  contractorSrc: string | null;
  /** The send action bound to this contract. */
  send: (name: string) => Promise<SendSignatureState>;
};

/** What the signing section holds for a contract: one of these, decided only from the status, the request and the role. */
export type SigningAreaKind = "send" | "sending" | "waiting" | "countersign" | "no_request" | "none";

export function signingAreaKind(props: Pick<SigningAreaProps, "contractStatus" | "request" | "role">): SigningAreaKind {
  const { contractStatus, request, role } = props;
  const canSign = canSignContracts(role);
  if (contractStatus === "pending_signature") {
    if (request?.status === "open") return "waiting";
    if (request?.status === "creating") return canSign ? "sending" : "none";
    return canSign ? "send" : "none";
  }
  if (contractStatus === "client_signed") {
    if (!request || !isLiveRequest(request.status)) return "no_request";
    return canSign && request.status === "open" ? "countersign" : "none";
  }
  if (contractStatus === "completed" && !request) return "no_request";
  return "none";
}

/** The signing section of the contract page (signature-provider S2, S4). */
export function SigningArea(props: SigningAreaProps) {
  const { customer, memberEmail, customerLinkUrl, contractorSrc, send, role } = props;
  const kind = signingAreaKind(props);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<SendSignatureState, FormData>(
    async (_previous, formData) => send(String(formData.get("name") ?? "")),
    { status: "idle" },
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(customerLinkUrl ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (kind === "none") return null;
  return (
    <section aria-label="Signature" className="flex flex-col gap-2 rounded-panel border border-hairline bg-surface px-4 py-3">
      <h2 className="text-[13px] font-semibold">Signature</h2>
      {kind === "send" && (
        <SendForSignaturePrompt
          customer={customer}
          memberEmail={memberEmail}
          confirming={confirming}
          pending={pending}
          state={state}
          onStart={() => setConfirming(true)}
          onCancel={() => setConfirming(false)}
          action={action}
        />
      )}
      {kind === "sending" && <p className="text-[13px] text-ink-2">This contract is being sent for signature.</p>}
      {kind === "waiting" && (
        <>
          <p className="text-[13px] text-ink-2">{WAITING_FOR_CUSTOMER}</p>
          {customerLinkUrl && canSignContracts(role) && <SigningLinkPanel url={customerLinkUrl} copied={copied} onCopy={copy} />}
        </>
      )}
      {kind === "countersign" &&
        (contractorSrc ? (
          <SigningForm src={contractorSrc} email={memberEmail} />
        ) : (
          <p role="alert" className="text-[13px] font-medium text-danger">
            The countersignature form could not be opened. Reload the page to try again.
          </p>
        ))}
      {kind === "no_request" && <p className="text-[13px] text-ink-2">{NO_REQUEST_RECORDED}</p>}
    </section>
  );
}
