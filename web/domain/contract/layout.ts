import { SAMPLE } from "../agreement/template-preview";
import { CONTRACT_SECTION_KEYS, validateLayout, type BlockItem, type DocOptions, type LayoutBody, type LayoutItem } from "../agreement/layout";
import type { AgreementTerms, DocumentSource, DocumentSourceLine } from "../agreement";
import { DEFAULT_ITEM_WORDS, type ItemWords, type OrgSettingsValue } from "../org-settings";
import { withLogo, type TenantLogo } from "../org-settings/logo";
import { buildContractDocument, type ContractDocument } from "./document";
import type { ContractParties } from "./parties";
import { validateBlocks, type BlockType, type TemplateBody } from "./template";

/** Schema 2 of the contract wording (block-editor door 1): the document options and the layout, with the signatures section in it. */
export type ContractLayoutBody = { schema: 2; doc: DocOptions; layout: LayoutItem[] };

/** What a stored contract template version holds: schema 1 blocks or schema 2 layout. */
export type ContractWordingBody = TemplateBody | ContractLayoutBody;

export const DEFAULT_CONTRACT_DOC: DocOptions = { title: "Service Contract", showMeta: true, pageHeader: "first", pageFooter: "number" };

export const MAX_WORDING_JSON_LENGTH = 60_000;

/**
 * The layout the contract PDF drew before layouts existed: the price table, the visit schedule, the service included, the
 * equipment, the wording blocks, then the signatures. `signaturesHeading` is the "Signatures" title that layout printed above the
 * blocks; a schema 2 layout prints none (a heading block says it when wanted).
 */
export function legacyContractLayout(blocks: readonly { type: BlockType; text: string }[], signaturesHeading = false): LayoutItem[] {
  return [
    { kind: "section", key: "price" },
    { kind: "section", key: "schedule" },
    { kind: "section", key: "included" },
    { kind: "section", key: "equipment" },
    ...blocks.map((block): BlockItem => ({ kind: "block", type: block.type, text: block.text })),
    signaturesHeading ? { kind: "section", key: "signatures", options: { heading: "Signatures" } } : { kind: "section", key: "signatures" },
  ];
}

/** A contract wording's layout and options: schema 1 as the code drew it before, schema 2 as stored. */
export function contractLayoutOf(body: ContractWordingBody): LayoutBody {
  if (body.schema === 2) return { doc: body.doc, layout: body.layout };
  return { doc: { ...DEFAULT_CONTRACT_DOC }, layout: legacyContractLayout(body.blocks) };
}

export type ContractWordingError = { field: string; message: string };
export type ContractWordingValidation = { ok: true; body: ContractWordingBody } | { ok: false; reason: string; errors: ContractWordingError[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether `input` is contract wording this product can store and draw: schema 1 as `validateBlocks` reads it, or schema 2 with the
 * document options and a layout that holds the price table and the signatures section once each, and no `terms` section.
 */
export function validateContractWording(input: unknown): ContractWordingValidation {
  const fail = (errors: ContractWordingError[]): ContractWordingValidation => ({ ok: false, reason: errors[0].message, errors });
  if (!isRecord(input)) return fail([{ field: "body", message: "The wording is not an object." }]);

  if (input.schema === 2) {
    const keys = ["schema", "doc", "layout"];
    const off = [...Object.keys(input).filter((key) => !keys.includes(key)), ...keys.filter((key) => !(key in input))];
    if (off.length > 0) return fail([{ field: "body", message: `A schema 2 wording has exactly the keys ${keys.join(", ")}; check ${off[0]}.` }]);
    const errors = validateLayout({ doc: input.doc, layout: input.layout }, { sections: CONTRACT_SECTION_KEYS, required: ["price", "signatures"], noun: "contract" });
    if (errors.length === 0 && JSON.stringify(input).length > MAX_WORDING_JSON_LENGTH) {
      return fail([{ field: "body", message: "The wording is too long to save. Shorten the texts." }]);
    }
    return errors.length > 0 ? fail(errors) : { ok: true, body: input as ContractLayoutBody };
  }

  const checked = validateBlocks(input);
  return checked.ok ? { ok: true, body: checked.body } : fail([{ field: "body", message: checked.reason }]);
}

/** The made-up contract a wording is drawn on, beside the sample agreement of a template preview. */
export const CONTRACT_SAMPLE = { ...SAMPLE, signer: { name: "Sample Signer", email: "signer@example.test" } } as const;

const SAMPLE_LINE: DocumentSourceLine = {
  description: "Quarterly maintenance visit",
  visitsPerYear: 4,
  costPerVisitCents: 45000,
  annualCents: 180000,
  visitMonths: [3, 6, 9, 12],
  equipment: [],
};

const daysInMonth = (year: number, month: number) =>
  month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
const isoDate = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** The last day of a term that starts on `start` (`YYYY-MM-DD`) and runs `months`: the day before the same day `months` later (the month's last day when it has no such day). */
function termEnd(start: string, months: number): string {
  const [year, month, day] = start.split("-").map(Number);
  const index = month - 1 + months;
  const endYear = year + Math.floor(index / 12);
  const endMonth = (index % 12) + 1;
  const sameDay = Math.min(day, daysInMonth(endYear, endMonth));
  if (sameDay > 1) return isoDate(endYear, endMonth, sameDay - 1);
  const [priorYear, priorMonth] = endMonth === 1 ? [endYear - 1, 12] : [endYear, endMonth - 1];
  return isoDate(priorYear, priorMonth, daysInMonth(priorYear, priorMonth));
}

/**
 * The contract PDF content of a wording filled with sample data (block-editor AC 44, domain side): number AG-0000, customer
 * "Sample Customer Ltd.", site "Sample Site", a signer, one priced sample line, the org's own letterhead and logo, today's terms
 * and a term starting today. It is `buildContractDocument` with a made-up source, so the preview and a real contract cannot drift.
 */
export function buildContractPreviewDocument(
  body: ContractWordingBody,
  settings: OrgSettingsValue,
  logo: TenantLogo | null,
  /** Today as `YYYY-MM-DD`, passed in because the domain reads no clock. */
  today: string,
  words: ItemWords = DEFAULT_ITEM_WORDS,
): ContractDocument {
  const terms: AgreementTerms = settings;
  const source: DocumentSource = {
    number: CONTRACT_SAMPLE.number,
    customer: { name: CONTRACT_SAMPLE.customer },
    site: { name: CONTRACT_SAMPLE.site },
    editable: false,
    shown: { versionNo: 1, lines: [SAMPLE_LINE], annualCents: SAMPLE_LINE.annualCents },
    serviceScope: { source: "live", takenAt: null, types: [] },
    terms,
    term: { start: today, months: settings.defaultTermMonths, end: termEnd(today, settings.defaultTermMonths) },
    validUntil: null,
  };
  const parties: ContractParties = {
    contractor: { legalName: settings.legalName, address: settings.address, phone: settings.phone },
    customer: { name: CONTRACT_SAMPLE.customer },
    site: { name: CONTRACT_SAMPLE.site, address: null },
    signer: CONTRACT_SAMPLE.signer,
  };
  return withLogo(buildContractDocument(source, parties, settings.accentColor, words, body), "contractor", logo);
}
