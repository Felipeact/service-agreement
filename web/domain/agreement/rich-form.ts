import { isRecord } from "../guards";
import { headerFromLetterhead, normalizeRichDoc, richFromLayout, richWarnings, type RichDoc } from "../rich-document";
import { DEFAULT_AGREEMENT_DOC, DEFAULT_LETTERHEAD, letterheadOf, layoutOf, type DocOptions, type LayoutItem, type SectionKey } from "./layout";
import { layoutFromRows, rowsFromLayout, type SectionRow } from "./layout-form";
import { validateAgreementTemplate, type AgreementTemplateBody } from "./template";
import {
  presetFromForm,
  readPresetLines,
  templateFormFromBodyFields,
  UNTITLED_PREVIEW_NAME,
  type FieldError,
  type TemplateFormErrors,
  type TemplateFormLine,
} from "./template-form";

/**
 * The Word-style editor's form for an agreement template (rich-templates): the name, description and preset as before, the
 * document options, and the page as the editor's JSON. Saving always writes schema 3.
 */
/** `header`: the page's header as the editor holds it, `null` for none. */
export type AgreementRichForm = { name: string; description: string; termMonths: string; lines: TemplateFormLine[]; doc: DocOptions; content: RichDoc; header: RichDoc | null };

/** A new template: a blank page with no title and no number lines, so the tenant designs everything. */
export const BLANK_DOC: DocOptions = { ...DEFAULT_AGREEMENT_DOC, title: "", showMeta: false };
export const BLANK_PAGE: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };
/** The header every new page starts with (it can be changed or removed): the standard letterhead as content. */
export const STANDARD_HEADER: RichDoc = headerFromLetterhead(DEFAULT_LETTERHEAD);
export const EMPTY_RICH_FORM: AgreementRichForm = { name: "", description: "", termMonths: "", lines: [], doc: BLANK_DOC, content: BLANK_PAGE, header: STANDARD_HEADER };

/** The header a body opens with: a designed one as stored (or none), else its letterhead options turned into content. */
export function headerOf(body: { schema: number; header?: RichDoc | null }, doc: DocOptions): RichDoc | null {
  return body.schema === 3 && body.header !== undefined ? body.header : headerFromLetterhead(letterheadOf(doc));
}

/** The page a stored body opens as: a designed page as stored, an older body converted (nothing is stored until a save). */
export function agreementContentOf(body: AgreementTemplateBody): RichDoc {
  return body.schema === 3 ? body.content : richFromLayout(layoutOf(body).layout);
}

/** The editor's starting values for a stored body of any schema. */
export function richFormFromBody(body: AgreementTemplateBody): AgreementRichForm {
  const { name, description, termMonths, lines } = templateFormFromBodyFields(body);
  const doc = layoutOf(body).doc;
  return { name, description, termMonths, lines, doc: { ...doc }, content: agreementContentOf(body), header: headerOf(body, doc) };
}

/**
 * The editor's fields to a schema 3 body, or a message for each field that cannot be one. The page is normalized first (colours
 * to `#rrggbb`, pasted sizes and fonts snapped, typed fields turned into chips); every rule is then `validateAgreementTemplate`'s.
 * `orgId`, when given, limits pictures to that org's uploads.
 */
export function bodyFromRichForm(input: AgreementRichForm, orgId?: string): { ok: true; body: AgreementTemplateBody } | { ok: false; errors: TemplateFormErrors } {
  const errors: TemplateFormErrors = {};
  const preset = presetFromForm(input, errors);
  const checked = validateAgreementTemplate(
    { schema: 3, name: input.name.trim(), description: input.description.trim(), doc: input.doc, content: normalizeRichDoc(input.content), header: input.header === null ? null : normalizeRichDoc(input.header), preset },
    { orgId },
  );
  if (!checked.ok) {
    for (const { field, message } of checked.errors) errors[field] ??= message;
  }
  if (Object.keys(errors).length > 0 || !checked.ok) return { ok: false, errors };
  return { ok: true, body: checked.body };
}

/** `bodyFromRichForm` for the preview: a template still being named is drawn like any other. */
export function previewBodyFromRichForm(input: AgreementRichForm, orgId?: string): ReturnType<typeof bodyFromRichForm> {
  return bodyFromRichForm(input.name.trim() === "" ? { ...input, name: UNTITLED_PREVIEW_NAME } : input, orgId);
}

/** Notes that do not stop a save, such as a page with no price lines table. */
export const agreementRichWarnings = (input: AgreementRichForm): string[] => richWarnings(input.content, "agreement");

/** A live section's stored options as the options form's row, every field at its empty value when not set. */
export function sectionRowOf(key: SectionKey, options: Record<string, unknown> | null | undefined): SectionRow {
  const item = (options ? { kind: "section", key, options } : { kind: "section", key }) as LayoutItem;
  const [row] = rowsFromLayout([item]);
  return row as SectionRow;
}

/** The options a row stores on its live section, `null` when every field is at its default. */
export function sectionOptionsOf(row: SectionRow): Record<string, unknown> | null {
  const [item] = layoutFromRows([row]);
  return item.kind === "section" && "options" in item && item.options ? (item.options as Record<string, unknown>) : null;
}

/** Whether a posted value is the Word-style editor's form. */
export const isRichFormInput = (value: unknown): value is AgreementRichForm => isRecord(value) && "content" in value;

/** The Word-style editor's fields as a posted JSON value; what the page and the options say is the validator's to judge. */
export function readRichFormInput(value: unknown): { ok: true; input: AgreementRichForm } | { ok: false; errors: FieldError[] } {
  const bad = (field: string, message: string) => ({ ok: false as const, errors: [{ field, message }] });
  if (!isRecord(value)) return bad("body", "Send the template's fields as a JSON object.");
  for (const key of ["name", "description", "termMonths"] as const) {
    if (typeof value[key] !== "string") return bad(key, "This field must be text.");
  }
  if (!isRecord(value.doc)) return bad("doc", "The document options must be an object.");
  if (!isRecord(value.content)) return bad("content", "The page must be a document.");
  if (value.header !== null && !isRecord(value.header)) return bad("header", "The header must be a document or none.");
  const lines = readPresetLines(value.lines);
  if (!lines.ok) return lines;
  return {
    ok: true,
    input: {
      name: value.name as string,
      description: value.description as string,
      termMonths: value.termMonths as string,
      lines: lines.lines,
      doc: value.doc as DocOptions,
      content: value.content as RichDoc,
      header: value.header as RichDoc | null,
    },
  };
}
