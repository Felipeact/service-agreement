import type { ItemWords, OrgSettingsValue } from "../org-settings";
import { withLogo, type TenantLogo } from "../org-settings/logo";
import { buildAgreementDocument, type AgreementDocument, type DocumentSource, type DocumentSourceLine } from "./document";
import type { AgreementTemplateBody, AgreementTemplateLine } from "./template";
import type { ScopeType } from "./index";

/** Printed on every page of a template preview, where an agreement says it is a draft (template-flow AC 25). */
export const PREVIEW_MARK = "TEMPLATE PREVIEW";

/** The made-up agreement a template is drawn on, so the member sees the layout the customer gets. */
export const SAMPLE = { number: "AG-0000", customer: "Sample Customer Ltd.", site: "Sample Site" } as const;

/** The lines a designed page with no preset lines is previewed on. */
export const SAMPLE_PRESET_LINES: AgreementTemplateLine[] = [
  { description: "Quarterly preventive maintenance", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: 45000 },
  { description: "Annual inspection", visitMonths: [5], assetTypeCodes: ["BOILER"], costPerVisitCents: 30000 },
];

/** The equipment a designed page with no preset lines is previewed on, matching the sample lines' codes. */
export const SAMPLE_SCOPE: ScopeType[] = [
  {
    code: "RTU",
    name: "Rooftop unit",
    tasks: [
      { description: "Replace filters", visitMonths: null },
      { description: "Check belts and refrigerant levels", visitMonths: null },
    ],
    assets: [
      { unitNo: "RTU-1", typeModel: null, location: "Roof" },
      { unitNo: "RTU-2", typeModel: null, location: "Roof" },
    ],
  },
  { code: "BOILER", name: "Boiler", tasks: [{ description: "Combustion test and safety controls check", visitMonths: null }], assets: [{ unitNo: "B-1", typeModel: null, location: "Mechanical room" }] },
];

/**
 * The agreement PDF of a template body filled with sample data: one price line per preset line (its price, or $0.00 when the
 * preset leaves it empty, as an unpriced line on a real agreement), the org's own letterhead, logo and today's terms, and the
 * mark TEMPLATE PREVIEW. It is `buildAgreementDocument` with a made-up source, so the preview and the real agreement cannot drift.
 */
export function buildTemplatePreviewDocument(body: AgreementTemplateBody, settings: OrgSettingsValue, logo: TenantLogo | null, words: ItemWords): AgreementDocument {
  // A designed page with no preset lines is drawn on sample lines and equipment, so its price table and schedule show what they look
  // like; schemas 1 and 2 keep the preview they always had.
  const designedSample = body.schema === 3 && body.preset.lines.length === 0;
  const presetLines = designedSample ? SAMPLE_PRESET_LINES : body.preset.lines;
  const lines: DocumentSourceLine[] = presetLines.map((line) => {
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
    serviceScope: { source: "live", takenAt: null, types: designedSample ? SAMPLE_SCOPE : [] },
    terms: null,
    term: { start: null, months: body.preset.termMonths ?? settings.defaultTermMonths, end: null },
    validUntil: null,
  };
  const document = buildAgreementDocument(source, settings, body);
  return withLogo({ ...document, mark: PREVIEW_MARK, words }, "tenant", logo);
}
