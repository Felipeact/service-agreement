import type { Container } from "@/composition";
import { buildAgreementDocument, buildTemplatePreviewDocument, PREVIEW_MARK, type AgreementTemplateBody } from "@/domain/agreement";
import { buildContractDocument, buildContractPreviewDocument, type ContractWordingBody } from "@/domain/contract";
import { itemWords } from "@/domain/org-settings";
import { withLogo } from "@/domain/org-settings/logo";
import { today } from "@/lib/business-day";

type Deps = Pick<Container, "getOrgSettings" | "tenantLogo" | "agreementReader">;

/** `missing` when the agreement asked for cannot be read (another org's, or gone); otherwise the PDF bytes. Throws when drawing fails. */
export type PreviewPdf = { ok: true; bytes: Uint8Array } | { ok: false; code: "missing" };

const settingsOf = async (deps: Deps, orgId: string) => {
  const settings = await deps.getOrgSettings(orgId);
  if (!settings) throw new Error(`org ${orgId} has no settings row`);
  return settings;
};

/**
 * The agreement PDF of a template body, marked TEMPLATE PREVIEW: on sample data, or on one of the org's own agreements (read under the
 * member's session, so another org's id is no agreement). It builds a document and writes nothing.
 */
export async function agreementPreviewPdf(deps: Deps & Pick<Container, "documentRenderer">, orgId: string, body: AgreementTemplateBody, agreementId: string | null): Promise<PreviewPdf> {
  const settings = await settingsOf(deps, orgId);
  const logo = await deps.tenantLogo(orgId);
  if (agreementId === null) {
    return { ok: true, bytes: await deps.documentRenderer.renderAgreement(buildTemplatePreviewDocument(body, settings, logo, itemWords(settings.itemSingular, settings.itemPlural))) };
  }
  const agreement = await deps.agreementReader.get(agreementId);
  if (!agreement) return { ok: false, code: "missing" };
  return { ok: true, bytes: await deps.documentRenderer.renderAgreement(withLogo({ ...buildAgreementDocument(agreement, settings, body), mark: PREVIEW_MARK }, "tenant", logo)) };
}

/** The contract PDF of a wording: on sample data, or on one of the org's own agreements with no signer chosen yet. */
export async function contractPreviewPdf(deps: Deps & Pick<Container, "contractRenderer" | "clock">, orgId: string, body: ContractWordingBody, agreementId: string | null): Promise<PreviewPdf> {
  const settings = await settingsOf(deps, orgId);
  const logo = await deps.tenantLogo(orgId);
  const words = itemWords(settings.itemSingular, settings.itemPlural);
  if (agreementId === null) {
    return { ok: true, bytes: await deps.contractRenderer.renderContract(buildContractPreviewDocument(body, settings, logo, today(deps.clock.now()), words)) };
  }
  const agreement = await deps.agreementReader.get(agreementId);
  if (!agreement) return { ok: false, code: "missing" };
  const parties = {
    contractor: { legalName: settings.legalName, address: settings.address, phone: settings.phone },
    customer: { name: agreement.customer.name },
    site: { name: agreement.site.name, address: null },
    signer: null,
  };
  return { ok: true, bytes: await deps.contractRenderer.renderContract(withLogo(buildContractDocument(agreement, parties, settings.accentColor, words, body), "contractor", logo)) };
}
