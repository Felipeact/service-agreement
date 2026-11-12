import {
  MAX_TEXT,
  renderBlocks,
  templateValues,
  validateBlocks,
  type Block,
  type RenderedBlock,
  type TemplateValues,
} from "../contract/template";
import type { AgreementTerms } from "./index";

/** A preset service line: copied into version 1 of a new agreement (agreement-templates door 2). */
export type AgreementTemplateLine = {
  description: string;
  /** Ascending, 1 = January. */
  visitMonths: number[];
  /** Equipment type codes, matched by code within the org when the template is used. */
  assetTypeCodes: string[];
  /** `null` leaves the line unpriced (0) for the estimator. */
  costPerVisitCents: number | null;
};

/** What a stored agreement template version holds (door 2). Equal in shape to the `document_template_versions.body` of kind `agreement`. */
export type AgreementTemplateBody = {
  schema: 1;
  name: string;
  description: string;
  /** Printed after the title block and before the price table. */
  intro: Block[];
  /** The closing text, printed after the terms and before the page footer. */
  footer: Block[];
  /** The optional sections; the price table, the terms and the page footer are always drawn. */
  sections: { schedule: boolean; scope: boolean };
  preset: { termMonths: number | null; lines: AgreementTemplateLine[] };
};

export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 300;
export const MAX_LIST_BLOCKS = 30;
export const MAX_PRESET_LINES = 20;
export const MAX_PRESET_TERM_MONTHS = 60;
/** The database refuses a code longer than this and a price above the ceiling; the app says so first (the save function's limits). */
export const MAX_CODE_LENGTH = 80;
export const MAX_PRICE_CENTS = 1_000_000_000_000;
/** The database caps a body at 64 KB of jsonb text, which spells `: ` and `, ` with a space; a body this long as plain JSON is certainly over. */
export const MAX_BODY_JSON_LENGTH = 60_000;

/** The system agreement template's version 1: no text, every optional section shown, no preset. Equal to the stored row (parity test). */
export const SYSTEM_AGREEMENT_BODY: AgreementTemplateBody = {
  schema: 1,
  name: "Standard agreement",
  description: "",
  intro: [],
  footer: [],
  sections: { schedule: true, scope: true },
  preset: { termMonths: null, lines: [] },
};

export type AgreementTemplateError = {
  /** `name`, `description`, `intro`, `footer`, `sections`, `preset.termMonths`, `preset.lines` or `preset.lines.<index>.<key>`; `body` for the whole input. */
  field: string;
  message: string;
};

export type AgreementTemplateValidation =
  | { ok: true; body: AgreementTemplateBody }
  | { ok: false; reason: string; errors: AgreementTemplateError[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

/** The keys of `value` that are not in `allowed`. */
const unknownKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).filter((key) => !allowed.includes(key));

function checkBlocks(field: "intro" | "footer", label: string, input: unknown, errors: AgreementTemplateError[]) {
  if (!Array.isArray(input)) {
    errors.push({ field, message: `The ${label} is not a list.` });
    return;
  }
  if (input.length > MAX_LIST_BLOCKS) {
    errors.push({ field, message: `The ${label} has too many blocks (${input.length}, at most ${MAX_LIST_BLOCKS}).` });
    return;
  }
  for (const [index, block] of input.entries()) {
    const extra = isRecord(block) ? unknownKeys(block, ["type", "text"]) : [];
    if (extra.length > 0) {
      errors.push({ field, message: `Block ${index + 1} of the ${label} has an unknown key: ${extra[0]}.` });
      return;
    }
    if (isRecord(block) && typeof block.text === "string" && block.text.trim() === "") {
      errors.push({ field, message: `Block ${index + 1} of the ${label} is empty.` });
      return;
    }
  }
  const checked = validateBlocks({ schema: 1, blocks: input });
  if (!checked.ok) errors.push({ field, message: `The ${label}: ${checked.reason}` });
}

function checkLine(line: unknown, index: number, errors: AgreementTemplateError[]) {
  const at = (key: string) => `preset.lines.${index}.${key}`;
  const n = index + 1;
  if (!isRecord(line)) {
    errors.push({ field: `preset.lines.${index}`, message: `Preset line ${n} is not an object.` });
    return;
  }
  const extra = unknownKeys(line, ["description", "visitMonths", "assetTypeCodes", "costPerVisitCents"]);
  if (extra.length > 0) errors.push({ field: `preset.lines.${index}`, message: `Preset line ${n} has an unknown key: ${extra[0]}.` });

  if (typeof line.description !== "string" || line.description.trim() === "") {
    errors.push({ field: at("description"), message: `Preset line ${n} needs a description.` });
  } else if (line.description.length > MAX_TEXT) {
    errors.push({ field: at("description"), message: `Preset line ${n} has a description over ${MAX_TEXT} characters.` });
  }

  const months = line.visitMonths;
  if (!Array.isArray(months) || months.length === 0) {
    errors.push({ field: at("visitMonths"), message: `Preset line ${n} needs at least one visit month.` });
  } else if (!months.every((month) => isWhole(month) && month >= 1 && month <= 12)) {
    errors.push({ field: at("visitMonths"), message: `Preset line ${n} has a visit month outside 1 to 12.` });
  } else if (new Set(months).size !== months.length) {
    errors.push({ field: at("visitMonths"), message: `Preset line ${n} repeats a visit month.` });
  }

  const codes = line.assetTypeCodes;
  if (!Array.isArray(codes) || !codes.every((code) => typeof code === "string" && code.trim() !== "")) {
    errors.push({ field: at("assetTypeCodes"), message: `Preset line ${n} has an equipment type code that is not text.` });
  } else if (!codes.every((code) => code.trim().length <= MAX_CODE_LENGTH)) {
    errors.push({ field: at("assetTypeCodes"), message: `Preset line ${n} has an equipment type code over ${MAX_CODE_LENGTH} characters.` });
  }

  const cost = line.costPerVisitCents;
  if (cost !== null && !(isWhole(cost) && cost >= 0 && cost <= MAX_PRICE_CENTS)) {
    errors.push({ field: at("costPerVisitCents"), message: `Preset line ${n} needs a price per visit that is empty or a whole number of cents, not negative.` });
  }
}

/**
 * Whether `input` is an agreement template body this product can store and draw (door 2): schema 1, exactly the known keys,
 * the text limits and the variable whitelist of the contract template, and the preset's bounds. Every problem is returned with
 * the field it belongs to; `reason` is the first.
 */
export function validateAgreementTemplate(input: unknown): AgreementTemplateValidation {
  const errors: AgreementTemplateError[] = [];
  if (!isRecord(input)) return { ok: false, reason: "The template is not an object.", errors: [{ field: "body", message: "The template is not an object." }] };

  if (input.schema !== 1) errors.push({ field: "body", message: `Unknown schema ${String(input.schema)}; this product reads schema 1.` });
  const extra = unknownKeys(input, ["schema", "name", "description", "intro", "footer", "sections", "preset"]);
  if (extra.length > 0) errors.push({ field: "body", message: `The template has an unknown key: ${extra[0]}.` });

  if (typeof input.name !== "string" || input.name.trim() === "") errors.push({ field: "name", message: "Name is required." });
  else if (input.name.length > MAX_NAME) errors.push({ field: "name", message: `Name is too long (${input.name.length} characters, at most ${MAX_NAME}).` });

  if (typeof input.description !== "string") errors.push({ field: "description", message: "Description must be text." });
  else if (input.description.length > MAX_DESCRIPTION) {
    errors.push({ field: "description", message: `Description is too long (${input.description.length} characters, at most ${MAX_DESCRIPTION}).` });
  }

  checkBlocks("intro", "intro", input.intro, errors);
  checkBlocks("footer", "closing text", input.footer, errors);

  const { sections } = input;
  if (!isRecord(sections) || typeof sections.schedule !== "boolean" || typeof sections.scope !== "boolean" || unknownKeys(sections, ["schedule", "scope"]).length > 0) {
    errors.push({ field: "sections", message: "Sections must say whether the schedule and the scope show." });
  }

  const { preset } = input;
  if (!isRecord(preset)) {
    errors.push({ field: "preset", message: "The preset is missing." });
  } else {
    const presetExtra = unknownKeys(preset, ["termMonths", "lines"]);
    if (presetExtra.length > 0) errors.push({ field: "preset", message: `The preset has an unknown key: ${presetExtra[0]}.` });
    const term = preset.termMonths;
    if (term !== null && !(isWhole(term) && term >= 1 && term <= MAX_PRESET_TERM_MONTHS)) {
      errors.push({ field: "preset.termMonths", message: `Term length must be empty or a whole number of months from 1 to ${MAX_PRESET_TERM_MONTHS}.` });
    }
    if (!Array.isArray(preset.lines)) {
      errors.push({ field: "preset.lines", message: "The preset lines are not a list." });
    } else if (preset.lines.length > MAX_PRESET_LINES) {
      errors.push({ field: "preset.lines", message: `Too many preset lines (${preset.lines.length}, at most ${MAX_PRESET_LINES}).` });
    } else {
      for (const [index, line] of preset.lines.entries()) checkLine(line, index, errors);
    }
  }

  if (errors.length === 0 && JSON.stringify(input).length > MAX_BODY_JSON_LENGTH) {
    errors.push({ field: "body", message: "The template is too long to save. Shorten the texts or remove preset lines." });
  }

  if (errors.length > 0) return { ok: false, reason: errors[0].message, errors };
  return { ok: true, body: input as AgreementTemplateBody };
}

/**
 * The editor's one text area to blocks: a line starting `# ` is a heading, a line starting `- ` a clause, any other
 * non-empty line a paragraph; blank lines are dropped (plan Assumptions).
 */
export function textToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    const type = line.startsWith("# ") ? "heading" : line.startsWith("- ") ? "clause" : "paragraph";
    const body = type === "paragraph" ? line : line.slice(2).trim();
    if (body !== "") blocks.push({ type, text: body });
  }
  return blocks;
}

/** The editor text of a list of blocks; the inverse of `textToBlocks` for those three line kinds. */
export function blocksToText(blocks: Block[]): string {
  return blocks.map((block) => (block.type === "heading" ? `# ${block.text}` : block.type === "clause" ? `- ${block.text}` : block.text)).join("\n");
}

const FREQUENCY_BY_VISITS: Record<number, string> = { 12: "Monthly", 4: "Quarterly", 2: "Semiannual", 1: "Annual" };

/** The card's label: Monthly, Quarterly, Semiannual or Annual when every preset line has that many visit months, else Mixed; none without lines. */
export function derivedFrequency(preset: AgreementTemplateBody["preset"]): string | null {
  if (preset.lines.length === 0) return null;
  const counts = new Set(preset.lines.map((line) => line.visitMonths.length));
  if (counts.size !== 1) return "Mixed";
  return FREQUENCY_BY_VISITS[[...counts][0]] ?? "Mixed";
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** `3 lines · 12 months term`, `3 lines` for a preset with no term, or `No preset lines`. */
export function presetLabel(lineCount: number, termMonths: number | null): string {
  return lineCount === 0 ? "No preset lines" : `${plural(lineCount, "line", "lines")}${termMonths === null ? "" : ` · ${plural(termMonths, "month", "months")} term`}`;
}

export type PreviewSummary = {
  /** `N sections`: the optional sections shown. */
  sections: string;
  /** `M clauses`: the clause blocks of the intro and the closing text. */
  clauses: string;
  /** The preset's equipment type codes in first-seen order, as the org's own type names (a code with no type stays the code). */
  equipmentTypes: string[];
  /** `3 lines · 12 months term`, `3 lines` for a preset with no term, or `No preset lines`. */
  preset: string;
};

/** What the preview panel counts, from the body and the org's types (`typeNames` maps a code to the org's name for it). */
export function previewSummary(body: AgreementTemplateBody, typeNames: Record<string, string>): PreviewSummary {
  const clauses = [...body.intro, ...body.footer].filter((block) => block.type === "clause").length;
  const codes = [...new Set(body.preset.lines.flatMap((line) => line.assetTypeCodes))];
  const { lines, termMonths } = body.preset;
  return {
    sections: plural(Number(body.sections.schedule) + Number(body.sections.scope), "section", "sections"),
    clauses: plural(clauses, "clause", "clauses"),
    equipmentTypes: codes.map((code) => typeNames[code] ?? code),
    preset: presetLabel(lines.length, termMonths),
  };
}

/** The preset's equipment type codes that name no type of the org, in first-seen order (plan AC 25). */
export function skippedCodes(body: AgreementTemplateBody, orgCodes: string[]): string[] {
  const known = new Set(orgCodes);
  return [...new Set(body.preset.lines.flatMap((line) => line.assetTypeCodes))].filter((code) => !known.has(code));
}

/**
 * The variables of an agreement's intro and closing text: the terms (the org's today for a draft, the version's frozen terms
 * once sent), the term's length and the tenant, customer and site names (the contract's own `templateValues`).
 */
export function agreementTemplateValues(
  terms: AgreementTerms | null,
  termMonths: number,
  names: { tenant: string; customer: string; site: string },
): TemplateValues {
  return templateValues(terms, termMonths, {
    contractor: { legalName: names.tenant, address: null, phone: null },
    customer: { name: names.customer },
    site: { name: names.site, address: null },
    signer: null,
  });
}

export type RenderedAgreementTemplate = {
  intro: RenderedBlock[];
  footer: RenderedBlock[];
  sections: { schedule: boolean; scope: boolean };
};

/** The body's texts with their variables filled (a clause with a missing value is omitted, a paragraph prints it empty) and its section flags. */
export function renderAgreementTemplate(body: AgreementTemplateBody, values: TemplateValues): RenderedAgreementTemplate {
  return {
    intro: renderBlocks({ schema: 1, blocks: body.intro }, values),
    footer: renderBlocks({ schema: 1, blocks: body.footer }, values),
    sections: { schedule: body.sections.schedule, scope: body.sections.scope },
  };
}

/**
 * The name of a duplicate: `<name> (copy)`, then `<name> (copy 2)` and so on until no name in `taken` (compared ignoring case and
 * outer spaces) is the same. A long name is cut so the copy still fits the name limit.
 */
export function copyName(name: string, taken: readonly string[]): string {
  const used = new Set(taken.map((other) => other.trim().toLowerCase()));
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
    const candidate = `${name.trim().slice(0, MAX_NAME - suffix.length).trimEnd()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
