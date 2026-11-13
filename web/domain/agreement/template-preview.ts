import type { ItemWords, OrgSettingsValue } from "../org-settings";
import { withLogo, type TenantLogo } from "../org-settings/logo";
import { buildAgreementDocument, type AgreementDocument, type DocumentSource, type DocumentSourceLine } from "./document";
import type { AgreementTemplateBody } from "./template";

/** Printed on every page of a template preview, where an agreement says it is a draft (template-flow AC 25). */
export const PREVIEW_MARK = "TEMPLATE PREVIEW";

/** The made-up agreement a template is drawn on, so the member sees the layout the customer gets. */
export const SAMPLE = { number: "AG-0000", customer: "Sample Customer Ltd.", site: "Sample Site" } as const;

/**
 * The agreement PDF of a template body filled with sample data: one price line per preset line (its price, or $0.00 when the
 * preset leaves it empty, as an unpriced line on a real agreement), the org's own letterhead, logo and today's terms, and the
 * mark TEMPLATE PREVIEW. It is `buildAgreementDocument` with a made-up source, so the preview and the real agreement cannot drift.
 */
export function buildTemplatePreviewDocument(body: AgreementTemplateBody, settings: OrgSettingsValue, logo: TenantLogo | null, words: ItemWords): AgreementDocument {
  const lines: DocumentSourceLine[] = body.preset.lines.map((line) => {
    const costPerVisitCents = line.costPerVisitCents ?? 0;
    const visitsPerYear = line.visitMonths.length;
    return {
      description: line.description,
      visitsPerYear,
      costPerVisitCents,
      annualCents: visitsPerYear * costPerVisitCents,
      visitMonths: line.visitMonths,
      equipment: line.assetTypeCodes.map((code) => ({ code, name: code })),
    };
  });
  const source: DocumentSource = {
    number: SAMPLE.number,
    customer: { name: SAMPLE.customer },
    site: { name: SAMPLE.site },
    // Editable: the terms are the org's today, as for a draft.
    editable: true,
    shown: { versionNo: 1, lines, annualCents: lines.reduce((sum, line) => sum + line.annualCents, 0) },
    serviceScope: { source: "live", takenAt: null, types: [] },
    terms: null,
    term: { start: null, months: body.preset.termMonths ?? settings.defaultTermMonths, end: null },
    validUntil: null,
  };
  const document = buildAgreementDocument(source, settings, body);
  return withLogo({ ...document, mark: PREVIEW_MARK, words }, "tenant", logo);
}
