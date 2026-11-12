import { parseCents } from "./index";
import { blocksToText, textToBlocks, validateAgreementTemplate, type AgreementTemplateBody } from "./template";

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
  return {
    name: body.name,
    description: body.description,
    intro: blocksToText(body.intro),
    footer: blocksToText(body.footer),
    schedule: body.sections.schedule,
    scope: body.sections.scope,
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
 * The editor's fields to a body, or a message for each field that cannot be one. A price or term that is not a number is reported
 * here; every other rule is `validateAgreementTemplate`'s, so the form and the database agree on what a body may hold.
 */
export function bodyFromTemplateForm(input: TemplateFormInput): { ok: true; body: AgreementTemplateBody } | { ok: false; errors: TemplateFormErrors } {
  const errors: TemplateFormErrors = {};

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

  const checked = validateAgreementTemplate({
    schema: 1,
    name: input.name.trim(),
    description: input.description.trim(),
    intro: textToBlocks(input.intro),
    footer: textToBlocks(input.footer),
    sections: { schedule: input.schedule, scope: input.scope },
    preset: { termMonths, lines },
  });
  if (!checked.ok) {
    for (const { field, message } of checked.errors) errors[field] ??= message;
  }
  if (Object.keys(errors).length > 0 || !checked.ok) return { ok: false, errors };
  return { ok: true, body: checked.body };
}
