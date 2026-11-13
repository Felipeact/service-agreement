import { parseCents } from "./index";
import { introAndFooter, layoutOf, sectionFlags } from "./layout";
import { layoutFromRows, readLayoutFormState, rowsFromLayout, type LayoutFieldError, type LayoutFormState } from "./layout-form";
import { blocksToText, MAX_PRESET_LINES, textToBlocks, validateAgreementTemplate, type AgreementTemplateBody } from "./template";

/** One preset line as the editor holds it: the price is the dollars as typed, the months and codes are the checked boxes. */
export type TemplateFormLine = { description: string; visitMonths: number[]; assetTypeCodes: string[]; costPerVisit: string };

/** The editor's fields as typed (agreement-templates AC 18): the intro and closing text are one text area each, the term is text. */
export type TemplateFormInput = {
  name: string;
  description: string;
  intro: string;
  footer: string;
  schedule: boolean;
  scope: boolean;
  termMonths: string;
  lines: TemplateFormLine[];
};

/** Field key (as `validateAgreementTemplate` names it) to the message shown beside the field. */
export type TemplateFormErrors = Record<string, string>;

export const EMPTY_TEMPLATE_FORM: TemplateFormInput = { name: "", description: "", intro: "", footer: "", schedule: true, scope: true, termMonths: "", lines: [] };

export const EMPTY_PRESET_LINE: TemplateFormLine = { description: "", visitMonths: [], assetTypeCodes: [], costPerVisit: "" };

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The editor's starting values for a stored body. */
export function templateFormFromBody(body: AgreementTemplateBody): TemplateFormInput {
  // A schema 2 body is read as a schema 1 form until the block editor replaces this form (block-editor S4).
  const { intro, footer } = body.schema === 2 ? introAndFooter(body.layout) : body;
  const { schedule, scope } = body.schema === 2 ? sectionFlags(body.layout) : body.sections;
  return {
    name: body.name,
    description: body.description,
    intro: blocksToText(intro),
    footer: blocksToText(footer),
    schedule,
    scope,
    termMonths: body.preset.termMonths === null ? "" : String(body.preset.termMonths),
    lines: body.preset.lines.map((line) => ({
      description: line.description,
      visitMonths: line.visitMonths,
      assetTypeCodes: line.assetTypeCodes,
      costPerVisit: line.costPerVisitCents === null ? "" : dollars(line.costPerVisitCents),
    })),
  };
}

/** The preset of a form: the term and each line's price as typed, with a message in `errors` for one that is not a number. */
function presetFromForm(input: { termMonths: string; lines: TemplateFormLine[] }, errors: TemplateFormErrors): AgreementTemplateBody["preset"] {
  const termText = input.termMonths.trim();
  let termMonths: number | null = null;
  if (termText !== "") {
    if (/^\d+$/.test(termText)) termMonths = Number(termText);
    else errors["preset.termMonths"] = "Enter the term length as a whole number of months, or leave it empty.";
  }

  const lines = input.lines.map((line, index) => {
    const costText = line.costPerVisit.trim();
    let costPerVisitCents: number | null = null;
    if (costText !== "") {
      costPerVisitCents = parseCents(costText);
      if (costPerVisitCents === null) errors[`preset.lines.${index}.costPerVisitCents`] = "Enter a price per visit like $450.00, or leave it empty.";
    }
    return {
      description: line.description.trim(),
      visitMonths: [...new Set(line.visitMonths)].sort((a, b) => a - b),
      assetTypeCodes: [...new Set(line.assetTypeCodes)],
      costPerVisitCents,
    };
  });
  return { termMonths, lines };
}

/**
 * The editor's fields to a body, or a message for each field that cannot be one. A price or term that is not a number is reported
 * here; every other rule is `validateAgreementTemplate`'s, so the form and the database agree on what a body may hold.
 */
export function bodyFromTemplateForm(input: TemplateFormInput): { ok: true; body: AgreementTemplateBody } | { ok: false; errors: TemplateFormErrors } {
  const errors: TemplateFormErrors = {};
  const preset = presetFromForm(input, errors);

  const checked = validateAgreementTemplate({
    schema: 1,
    name: input.name.trim(),
    description: input.description.trim(),
    intro: textToBlocks(input.intro),
    footer: textToBlocks(input.footer),
    sections: { schedule: input.schedule, scope: input.scope },
    preset,
  });
  if (!checked.ok) {
    for (const { field, message } of checked.errors) errors[field] ??= message;
  }
  if (Object.keys(errors).length > 0 || !checked.ok) return { ok: false, errors };
  return { ok: true, body: checked.body };
}

/** A field-level message as the preview route answers it (template-flow AC 27). */
export type FieldError = { field: string; message: string };

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isMonths = (value: unknown): value is number[] => Array.isArray(value) && value.every((item) => Number.isInteger(item));

/** The preset lines of a posted value: a list of at most 20, each with the editor's own field types. */
function readPresetLines(value: unknown): { ok: true; lines: TemplateFormLine[] } | { ok: false; errors: FieldError[] } {
  const bad = (field: string, message: string) => ({ ok: false as const, errors: [{ field, message }] });
  if (!Array.isArray(value)) return bad("preset.lines", "The preset lines must be a list.");
  if (value.length > MAX_PRESET_LINES) return bad("preset.lines", `A template can have at most ${MAX_PRESET_LINES} lines.`);
  const lines: TemplateFormLine[] = [];
  for (const [index, line] of value.entries()) {
    const item = (typeof line === "object" && line !== null ? line : {}) as Record<string, unknown>;
    if (typeof item.description !== "string" || typeof item.costPerVisit !== "string" || !isMonths(item.visitMonths) || !isStrings(item.assetTypeCodes)) {
      return bad(`preset.lines.${index}`, "Each preset line needs a description, months, equipment codes and a price as text.");
    }
    lines.push({ description: item.description, costPerVisit: item.costPerVisit, visitMonths: item.visitMonths, assetTypeCodes: item.assetTypeCodes });
  }
  return { ok: true, lines };
}

/**
 * The editor's fields as a posted JSON value: every field the right type, and no more lines than a template may hold, so what
 * reaches `bodyFromTemplateForm` is the editor's own shape. Anything else is one error naming where it went wrong.
 */
export function readTemplateFormInput(value: unknown): { ok: true; input: TemplateFormInput } | { ok: false; errors: FieldError[] } {
  const bad = (field: string, message: string) => ({ ok: false as const, errors: [{ field, message }] });
  if (typeof value !== "object" || value === null || Array.isArray(value)) return bad("body", "Send the template's fields as a JSON object.");
  const form = value as Record<string, unknown>;
  for (const key of ["name", "description", "intro", "footer", "termMonths"] as const) {
    if (typeof form[key] !== "string") return bad(key, "This field must be text.");
  }
  for (const key of ["schedule", "scope"] as const) {
    if (typeof form[key] !== "boolean") return bad(key, "This field must be true or false.");
  }
  const read = readPresetLines(form.lines);
  if (!read.ok) return read;
  const lines = read.lines;
  return {
    ok: true,
    input: {
      name: form.name as string,
      description: form.description as string,
      intro: form.intro as string,
      footer: form.footer as string,
      schedule: form.schedule as boolean,
      scope: form.scope as boolean,
      termMonths: form.termMonths as string,
      lines,
    },
  };
}

/** What the preview draws for a template that has no name yet: the name is not printed on the agreement. */
export const UNTITLED_PREVIEW_NAME = "Untitled template";

/**
 * `bodyFromTemplateForm` for the preview: a template still being named is drawn like any other, so a new template shows the
 * Standard layout at once (template-flow AC 24). Saving still requires the name.
 */
export function previewBodyFromTemplateForm(input: TemplateFormInput): ReturnType<typeof bodyFromTemplateForm> {
  return bodyFromTemplateForm(input.name.trim() === "" ? { ...input, name: UNTITLED_PREVIEW_NAME } : input);
}

/** The block editor's form for an agreement template (block-editor Landing row 7): the preset as before, the layout as rows. */
export type AgreementLayoutForm = LayoutFormState & { name: string; description: string; termMonths: string; lines: TemplateFormLine[] };

export const EMPTY_LAYOUT_FORM: AgreementLayoutForm = layoutFormFromBody({
  schema: 1,
  name: "",
  description: "",
  intro: [],
  footer: [],
  sections: { schedule: true, scope: true },
  preset: { termMonths: null, lines: [] },
});

/** The block editor's starting values for a stored body: a schema 1 body as the rows `layoutOf` gives, a schema 2 body as stored (block-editor AC 36). */
export function layoutFormFromBody(body: AgreementTemplateBody): AgreementLayoutForm {
  const { doc, layout } = layoutOf(body);
  const { name, description, termMonths, lines } = templateFormFromBodyFields(body);
  return { name, description, termMonths, lines, doc: { ...doc }, layout: rowsFromLayout(layout) };
}

/** The preset fields of a stored body in the editor's typed shape, shared by both forms. */
function templateFormFromBodyFields(body: AgreementTemplateBody) {
  return {
    name: body.name,
    description: body.description,
    termMonths: body.preset.termMonths === null ? "" : String(body.preset.termMonths),
    lines: body.preset.lines.map((line) => ({
      description: line.description,
      visitMonths: line.visitMonths,
      assetTypeCodes: line.assetTypeCodes,
      costPerVisit: line.costPerVisitCents === null ? "" : dollars(line.costPerVisitCents),
    })),
  };
}

/**
 * The block editor's fields to a schema 2 body, or a message for each field that cannot be one: a price or term that is not a
 * number here, every other rule `validateAgreementTemplate`'s. The layout's messages are keyed `layout.<row>...`.
 */
export function bodyFromLayoutForm(input: AgreementLayoutForm): { ok: true; body: AgreementTemplateBody } | { ok: false; errors: TemplateFormErrors } {
  const errors: TemplateFormErrors = {};
  const preset = presetFromForm(input, errors);
  const checked = validateAgreementTemplate({
    schema: 2,
    name: input.name.trim(),
    description: input.description.trim(),
    doc: input.doc,
    layout: layoutFromRows(input.layout),
    preset,
  });
  if (!checked.ok) {
    for (const { field, message } of checked.errors) errors[field] ??= message;
  }
  if (Object.keys(errors).length > 0 || !checked.ok) return { ok: false, errors };
  return { ok: true, body: checked.body };
}

/** `bodyFromLayoutForm` for the preview: a template still being named is drawn like any other (template-flow AC 24). */
export function previewBodyFromLayoutForm(input: AgreementLayoutForm): ReturnType<typeof bodyFromLayoutForm> {
  return bodyFromLayoutForm(input.name.trim() === "" ? { ...input, name: UNTITLED_PREVIEW_NAME } : input);
}

/** Whether a posted value is the block editor's form rather than the old one. */
export const isLayoutFormInput = (value: unknown): value is AgreementLayoutForm => typeof value === "object" && value !== null && "layout" in value;

/** The block editor's fields as a posted JSON value, every field the right type. */
export function readLayoutFormInput(value: unknown): { ok: true; input: AgreementLayoutForm } | { ok: false; errors: LayoutFieldError[] } {
  const bad = (field: string, message: string) => ({ ok: false as const, errors: [{ field, message }] });
  if (typeof value !== "object" || value === null || Array.isArray(value)) return bad("body", "Send the template's fields as a JSON object.");
  const form = value as Record<string, unknown>;
  for (const key of ["name", "description", "termMonths"] as const) {
    if (typeof form[key] !== "string") return bad(key, "This field must be text.");
  }
  const state = readLayoutFormState(form);
  if (!state.ok) return state;
  const lines = readPresetLines(form.lines);
  if (!lines.ok) return lines;
  return { ok: true, input: { name: form.name as string, description: form.description as string, termMonths: form.termMonths as string, lines: lines.lines, ...state.state } };
}
