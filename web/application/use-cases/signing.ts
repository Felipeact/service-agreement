import { createHash } from "node:crypto";
import { buildContractDocument, signingLinkUrl, signingState, type SigningState } from "@/domain/contract";
import type {
  AgreementReader,
  ContractDocuments,
  ContractReader,
  ContractRenderer,
  PortalTokens,
  SendForSignatureResult,
  SignatureProvider,
  SignatureStore,
  SigningReader,
  SigningView,
} from "@/application/ports";

export type SendForSignatureInput = {
  contractId: string;
  /** The member's org: the contract's frozen terms and the tenant's colour are read for it. */
  orgId: string;
  /** The owner or admin who presses Send; they sign for the contractor (signature-provider assumption). */
  contractorName: string;
  contractorEmail: string;
  /** Where the customer's link points; the caller decides (`APP_BASE_URL`, else the request's origin). */
  baseUrl: string;
};

type Dependencies = {
  documents: ContractDocuments;
  store: SignatureStore;
  renderer: ContractRenderer;
  provider: SignatureProvider;
  /** Made with `SIGNING_LINK_KEY`, so a value sealed for the portal does not open here (door 4). */
  tokens: PortalTokens;
};

/**
 * Claim, render, ask the provider, store (signature-provider Flow hops 2 to 4). The contract is claimed first, so two sends
 * cannot make two legal requests; a failure after the provider accepted voids the submission, so nothing is left signable
 * that the app does not know about. A refusal is a value; the caller shows it.
 */
export function makeSendForSignature({ documents, store, renderer, provider, tokens }: Dependencies) {
  return async function sendForSignature(input: SendForSignatureInput): Promise<SendForSignatureResult> {
    const loaded = await documents.load(input.contractId, input.orgId);
    if (!loaded) return { ok: false, code: "not_found" };
    const { number, document } = loaded;
    if (!document.signer) return { ok: false, code: "parties_missing" };

    const { token, hash } = tokens.create();
    let linkSealed: string;
    try {
      // Sealing needs the key; without it nothing is begun, so no request is left `creating`.
      linkSealed = tokens.seal(token);
    } catch (cause) {
      console.error(`Sending a contract for signature failed before it began: ${cause instanceof Error ? cause.message : String(cause)}`);
      return { ok: false, code: "unavailable" };
    }

    const begun = await store.begin(input.contractId, input.contractorName, hash);
    if (!begun.ok) return begun;
    const requestId = begun.requestId;

    let pdf: Uint8Array;
    try {
      pdf = await renderer.renderContract(document);
    } catch (cause) {
      console.error(`Rendering contract ${input.contractId} for signature failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      await store.fail(requestId);
      return { ok: false, code: "unavailable" };
    }

    const asked = await provider.createRequest({
      contractId: input.contractId,
      number,
      pdf,
      signers: [
        { role: "customer", name: document.signer.name, email: document.signer.email },
        { role: "contractor", name: input.contractorName, email: input.contractorEmail },
      ],
    });
    if (!asked.ok) {
      await store.fail(requestId);
      return { ok: false, code: asked.code };
    }

    try {
      const completed = await store.complete(
        requestId,
        asked.submissionId,
        asked.signers.map((signer) => ({ role: signer.role, submitterId: signer.submitterId, embedSealed: tokens.seal(signer.embedSrc) })),
        linkSealed,
        createHash("sha256").update(pdf).digest("hex"),
      );
      if (completed.ok) return { ok: true, link: signingLinkUrl(input.baseUrl, token) };
      console.error(`Storing signature request ${requestId} failed after DocuSeal accepted submission ${asked.submissionId}`);
    } catch (cause) {
      console.error(`Storing signature request ${requestId} failed after DocuSeal accepted submission ${asked.submissionId}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }

    // The provider holds a request the app cannot find: take it back, or say which one is left.
    const voided = await provider.void(asked.submissionId);
    if (!voided.ok) console.error(`DocuSeal submission ${asked.submissionId} could not be voided (${voided.code}) and is still open`);
    await store.fail(requestId);
    return { ok: false, code: "unavailable" };
  };
}

/**
 * The contract as the renderer draws it, for the member's org: the accepted version's lines and frozen terms, the
 * contract's own parties, the tenant's colour as the settings hold it now (the same inputs as the PDF route).
 * `null` when the contract is missing or recorded no parties; a missing settings row is thrown, as the PDF route's 503.
 */
export function makeContractDocuments(
  contracts: ContractReader,
  agreements: AgreementReader,
  getSettings: (orgId: string) => Promise<{ accentColor: string | null } | null>,
): ContractDocuments {
  return {
    async load(contractId, orgId) {
      const contract = await contracts.get(contractId);
      if (!contract || !contract.parties) return null;
      const agreement = await agreements.get(contract.agreementId, contract.versionNo);
      if (!agreement) return null;
      const settings = await getSettings(orgId);
      if (!settings) throw new Error(`org ${orgId} has no settings row`);
      return { number: contract.number, document: buildContractDocument(agreement, contract.parties, settings.accentColor) };
    },
  };
}

/** What `/sign/<token>` renders: `null` for no link, `unavailable` when the form's address cannot be opened. */
export type ViewSigningResult =
  | null
  | { state: "unavailable" }
  | { state: SigningState; tenant: SigningView["tenant"]; agreementNumber: string; signerName: string; embedSrc: string | null };

/**
 * One read of `signature_view` and nothing else: the page never writes a status (signature-provider AC 22, AC 23). The
 * form's address is unsealed here; without the key, or with a changed value, the page says the link is not working.
 */
export function makeViewSigning(reader: SigningReader, tokens: PortalTokens) {
  return async function viewSigning(token: string): Promise<ViewSigningResult> {
    const view = await reader.view(tokens.hash(token));
    if (!view) return null;
    const state = signingState({ requestStatus: view.requestStatus, contractStatus: view.contractStatus });
    let embedSrc: string | null = null;
    if (state === "open") {
      try {
        if (!view.embedSealed) throw new Error("the request is open but holds no embed link");
        embedSrc = tokens.unseal(view.embedSealed);
      } catch (cause) {
        console.error(`Opening the signing form failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        return { state: "unavailable" };
      }
    }
    return { state, tenant: view.tenant, agreementNumber: view.agreementNumber, signerName: view.signerName, embedSrc };
  };
}
