import { applyAgreementCommand } from "@/domain/agreement";
import type { AgreementRepository, AgreementSender, PortalLinkStore, PortalTokens, PortalWriteFailure } from "@/application/ports";

/** The new link's secret, handed back once; the database keeps only its hash (customer-portal door 1). */
export type LinkIssueResult = { ok: true; token: string } | { ok: false; code: PortalWriteFailure | "no_lines" };

/** A draft goes to `sent` with a new link. A refusal is a value; an infrastructure failure is thrown. */
export function makeSendAgreement(agreements: AgreementRepository, sender: AgreementSender, tokens: PortalTokens) {
  return async function sendAgreement(agreementId: string): Promise<LinkIssueResult> {
    const record = await agreements.findById(agreementId);
    if (!record) return { ok: false, code: "not_found" };
    const decision = applyAgreementCommand(record.status, { type: "send" });
    if (!decision.ok) return { ok: false, code: "conflict" };

    const { token, hash } = tokens.create();
    const sent = await sender.send(agreementId, hash, decision.event);
    return sent.ok ? { ok: true, token } : sent;
  };
}

/** A sent agreement gets a new link and the old one stops working. */
export function makeReissueLink(links: PortalLinkStore, tokens: PortalTokens) {
  return async function reissueLink(agreementId: string): Promise<LinkIssueResult> {
    const { token, hash } = tokens.create();
    const reissued = await links.reissue(agreementId, hash);
    return reissued.ok ? { ok: true, token } : reissued;
  };
}
