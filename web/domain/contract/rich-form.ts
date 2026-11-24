import { isRecord } from "../guards";
import type { DocOptions } from "../agreement/layout";
import { normalizeRichDoc, richFromLayout, richWarnings, type RichDoc } from "../rich-document";
import { headerOf } from "../agreement/rich-form";
import { contractLayoutOf, legacyContractLayout, validateContractWording, type ContractWordingBody } from "./layout";

/** The Word-style editor's form for the contract wording (rich-templates): the document options and the page. Saving writes schema 3. */
export type ContractRichForm = { doc: DocOptions; content: RichDoc; header: RichDoc | null };

/** The page stored wording opens as: a designed page as stored, older wording converted (schema 1 with the "Signatures" title it printed). */
export function contractContentOf(body: ContractWordingBody): RichDoc {
  if (body.schema === 3) return body.content;
  return richFromLayout(body.schema === 2 ? body.layout : legacyContractLayout(body.blocks, true));
}

/** The editor's starting values for stored wording of any schema. */
export function contractRichFormFromBody(body: ContractWordingBody): ContractRichForm {
  const doc = contractLayoutOf(body).doc;
  return { doc: { ...doc }, content: contractContentOf(body), header: headerOf(body, doc) };
}

/** The editor's fields to schema 3 wording (the page normalized first), or a message for each field that cannot be one. */
export function bodyFromContractRichForm(input: ContractRichForm, orgId?: string): { ok: true; body: ContractWordingBody } | { ok: false; errors: Record<string, string> } {
  const checked = validateContractWording({ schema: 3, doc: input.doc, content: normalizeRichDoc(input.content), header: input.header === null ? null : normalizeRichDoc(input.header) }, { orgId });
  if (checked.ok) return { ok: true, body: checked.body };
  const errors: Record<string, string> = {};
  for (const { field, message } of checked.errors) errors[field] ??= message;
  return { ok: false, errors };
}

/** Notes that do not stop a save, such as a page with no price lines table. */
export const contractRichWarnings = (input: ContractRichForm): string[] => richWarnings(input.content, "contract");

/** Whether a posted value is the Word-style editor's form. */
export const isContractRichFormInput = (value: unknown): value is ContractRichForm => isRecord(value) && "content" in value;

/** The Word-style editor's fields as a posted JSON value; what they say is the validator's to judge. */
export function readContractRichFormInput(value: unknown): { ok: true; input: ContractRichForm } | { ok: false; errors: { field: string; message: string }[] } {
  if (!isRecord(value)) return { ok: false, errors: [{ field: "body", message: "Send the wording's fields as a JSON object." }] };
  if (!isRecord(value.doc)) return { ok: false, errors: [{ field: "doc", message: "The document options must be an object." }] };
  if (!isRecord(value.content)) return { ok: false, errors: [{ field: "content", message: "The page must be a document." }] };
  if (value.header !== null && !isRecord(value.header)) return { ok: false, errors: [{ field: "header", message: "The header must be a document or none." }] };
  return { ok: true, input: { doc: value.doc as DocOptions, content: value.content as RichDoc, header: value.header as RichDoc | null } };
}
