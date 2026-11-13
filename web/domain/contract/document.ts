import { documentBody, NEUTRAL_ACCENT, renderLayout, sectionOptions, typeFrequencies, type AgreementDocument, type AgreementTerms, type DocumentSource, type IncludedOptions } from "../agreement";
import { contractLayoutOf, legacyContractLayout, type ContractWordingBody } from "./layout";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "../org-settings";
import type { TenantLogo } from "../org-settings/logo";
import type { ContractParties } from "./parties";
import { fillVariables, renderBlocks, SYSTEM_CONTRACT_BODY, templateValues, type RenderedBlock } from "./template";

/**
 * Everything one rendered contract says, decided and ordered, with no layout in it. The agreement's lines, schedule,
 * scope and term come from the accepted version; who is bound comes from the contract's own parties.
 */
export type ContractDocument = Pick<AgreementDocument, "number" | "versionNo" | "lines" | "totalCents" | "schedule" | "scope" | "term" | "layout" | "doc" | "frequencies"> & {
  contractor: { name: string; address: string | null; phone: string | null; accent: string; logo?: TenantLogo };
  /** The org's item words, for the covered-items section (item-vocabulary AC 9). */
  words?: ItemWords;
  customerName: string;
  site: { name: string; address: string | null };
  signer: { name: string; email: string } | null;
  /** The frozen tax note, printed under the total. */
  taxNote: string | null;
  /** The contract's terms as its template version words them: headings, paragraphs and the clauses whose terms are set, in order (contract-templates). */
  body: RenderedBlock[];
  /** Always `null`: only an accepted agreement becomes a contract. */
  mark: null;
};

/**
 * The sentences the system template states as clauses for the accepted version's frozen terms (contract-generation AC 28):
 * the system wording rendered, without its heading.
 */
export function contractClauses(terms: AgreementTerms | null, termMonths: number): string[] {
  return renderBlocks(SYSTEM_CONTRACT_BODY, templateValues(terms, termMonths, null))
    .filter((block) => block.type === "clause")
    .map((block) => block.text);
}

/** `accent` is the tenant's colour as the settings hold it now; a colour is branding, not who is bound. */
export function buildContractDocument(
  source: DocumentSource,
  parties: ContractParties,
  accent: string | null,
  words: ItemWords = DEFAULT_ITEM_WORDS,
  /** The template version the contract was made from; absent means the system wording (which every older fixture assumed). */
  template: ContractWordingBody = SYSTEM_CONTRACT_BODY,
): ContractDocument {
  const body = documentBody(source);
  const values = templateValues(source.terms, source.term.months, parties, source.term.start);
  // A schema 1 body goes through `renderBlocks` and the layout the contract drew before, so it prints exactly what it printed.
  const wording = template.schema === 1 ? renderBlocks(template, values) : null;
  const { doc, layout } =
    template.schema === 1
      ? { doc: contractLayoutOf(template).doc, layout: legacyContractLayout(wording ?? [], true) }
      : { doc: { ...template.doc, title: fillVariables(template.doc.title, values).text }, layout: renderLayout(template.layout, values) };
  const included = sectionOptions(layout, "included") as IncludedOptions | undefined;
  return {
    number: source.number,
    versionNo: source.shown.versionNo,
    lines: body.lines,
    totalCents: body.totalCents,
    schedule: body.schedule,
    scope: body.scope,
    term: body.term,
    contractor: { name: parties.contractor.legalName, address: parties.contractor.address, phone: parties.contractor.phone, accent: accent ?? NEUTRAL_ACCENT },
    words,
    customerName: parties.customer.name,
    site: parties.site,
    signer: parties.signer,
    taxNote: source.terms?.taxNote ?? null,
    body: wording ?? layout.flatMap((item) => (item.kind === "block" ? [{ type: item.type, text: item.text }] : [])),
    mark: null,
    layout,
    doc,
    ...(included?.showFrequency ? { frequencies: typeFrequencies(source.shown.lines, body.scope.kind === "listed" ? body.scope.types : []) } : {}),
  };
}
