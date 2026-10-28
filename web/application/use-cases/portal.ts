import { applyAgreementCommand, buildAgreementDocument, parseServiceScope, type AgreementDocument } from "@/domain/agreement";
import { isPortalToken, portalState, type PortalState } from "@/domain/portal";
import type { AgreementServiceScope, PortalDecider, PortalReader, PortalTokens, PortalView, PortalViewRecorder } from "@/application/ports";

/** The link's view, or `null` for an unknown link and for a token that cannot be one (no database call). */
export function makeViewPortal(reader: PortalReader, tokens: PortalTokens) {
  return async function viewPortal(token: string): Promise<PortalView | null> {
    return isPortalToken(token) ? reader.view(tokens.hash(token)) : null;
  };
}

export type PortalDecision = "accept" | "refuse" | "request_changes";

export type DecidePortalResult =
  | { ok: true }
  | { ok: false; code: "reason_required" | "reason_too_long" }
  /** `view` is what the link shows now, so the caller can name the state; `null` when no link has the token. */
  | { ok: false; code: "not_open"; view: PortalView | null };

/**
 * The customer's decision. The reason is checked by the same machine staff use, before any database call. When the
 * link is no longer open the link is read again: the same decision already on record is a success (a double click, a
 * retry), anything else is `not_open` with the state the link is in (customer-portal AC 21 to 24, door 9).
 */
export function makeDecidePortal(reader: PortalReader, decider: PortalDecider, tokens: PortalTokens) {
  return async function decidePortal(token: string, decision: PortalDecision, reason: string): Promise<DecidePortalResult> {
    if (!isPortalToken(token)) return { ok: false, code: "not_open", view: null };
    const checked = applyAgreementCommand("sent", decision === "accept" ? { type: "accept" } : { type: decision, reason });
    if (!checked.ok) return { ok: false, code: checked.error.code === "reason_too_long" ? "reason_too_long" : "reason_required" };

    const hash = tokens.hash(token);
    const decided = await decider.decide(hash, checked.event);
    if (decided.ok) return { ok: true };
    const view = await reader.view(hash);
    if (view?.decision?.status === checked.event.to && !view.link.revoked) return { ok: true };
    return { ok: false, code: "not_open", view };
  };
}

/** The first view of a live link; a token that cannot be one writes nothing. */
export function makeRecordPortalView(recorder: PortalViewRecorder, tokens: PortalTokens) {
  return async function recordPortalView(token: string): Promise<void> {
    if (isPortalToken(token)) await recorder.record(tokens.hash(token));
  };
}

/** What the version covered when it left draft; `not_recorded` for a placeholder or a document that is not a scope. */
export function portalScope(view: PortalView): AgreementServiceScope {
  const scope = parseServiceScope(view.scope);
  if (!scope) return { source: "not_recorded" };
  return { source: "frozen", takenAt: scope.takenAt === null ? null : new Date(scope.takenAt), types: scope.types };
}

/** The PDF content of a link: its tenant's paper, the version's lines, scope and frozen terms. `null` when the tenant has no settings row. */
export function portalDocument(view: PortalView): AgreementDocument | null {
  if (!view.tenant) return null;
  const terms = view.terms;
  return buildAgreementDocument(
    {
      number: view.agreement.number,
      customer: view.customer,
      site: view.site,
      editable: false,
      shown: { versionNo: view.link.versionNo, lines: view.lines, annualCents: view.annualCents },
      serviceScope: portalScope(view),
      terms,
    },
    // A frozen version prints its own terms; these are read only for the editable draft, which a link never shows.
    {
      legalName: view.tenant.name,
      address: view.tenant.address,
      phone: view.tenant.phone,
      accentColor: view.tenant.accent,
      repairDiscountPct: terms?.repairDiscountPct ?? 0,
      cpiCapPct: terms?.cpiCapPct ?? 0,
      cancellationNoticeDays: terms?.cancellationNoticeDays ?? null,
      paymentDays: terms?.paymentDays ?? null,
      governingProvince: terms?.governingProvince ?? null,
      taxNote: terms?.taxNote ?? null,
    },
  );
}

/** The state a link is in, `unknown` for no link. */
export function portalViewState(view: PortalView | null): PortalState {
  return portalState({ link: view ? { revoked: view.link.revoked, current: view.link.current } : null, status: view?.agreement.status ?? "draft" });
}
