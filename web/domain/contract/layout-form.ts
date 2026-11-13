import { layoutFromRows, readLayoutFormState, rowsFromLayout, type LayoutFieldError, type LayoutFormState } from "../agreement/layout-form";
import { contractLayoutOf, legacyContractLayout, validateContractWording, type ContractWordingBody } from "./layout";

/** The contract wording editor's form (block-editor Landing row 7): the document options and the rows, with the signatures section among them. */
export type ContractLayoutForm = LayoutFormState;

/** The editor's starting values for stored wording: schema 1 as the rows `contractLayoutOf` gives (plus the heading its signatures always had), schema 2 as stored (block-editor AC 41). */
export function contractFormFromBody(body: ContractWordingBody): ContractLayoutForm {
  const { doc, layout } = contractLayoutOf(body);
  // A schema 1 contract prints a "Signatures" title above the blocks; as schema 2 it is the heading row it always looked like.
  return { doc: { ...doc }, layout: rowsFromLayout(body.schema === 2 ? layout : legacyContractLayout(body.blocks, true)) };
}

/** The editor's fields to schema 2 wording, or a message for each field that cannot be one, keyed `layout.<row>...` as the validator names them. */
export function bodyFromContractForm(input: ContractLayoutForm): { ok: true; body: ContractWordingBody } | { ok: false; errors: Record<string, string> } {
  const checked = validateContractWording({ schema: 2, doc: input.doc, layout: layoutFromRows(input.layout) });
  if (checked.ok) return { ok: true, body: checked.body };
  const errors: Record<string, string> = {};
  for (const { field, message } of checked.errors) errors[field] ??= message;
  return { ok: false, errors };
}

/** The wording editor's fields as a posted JSON value, every field the right type. */
export function readContractFormInput(value: unknown): { ok: true; input: ContractLayoutForm } | { ok: false; errors: LayoutFieldError[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, errors: [{ field: "body", message: "Send the wording's fields as a JSON object." }] };
  const state = readLayoutFormState(value as Record<string, unknown>);
  return state.ok ? { ok: true, input: state.state } : state;
}

