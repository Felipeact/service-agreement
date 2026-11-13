import { BLOCK_TYPES, fillVariables, MAX_TEXT, unknownVariable, type BlockType, type TemplateValues } from "../contract/template";
import type { AgreementTemplateBody } from "./template";

/**
 * The layout of a document (block-editor door 1): the ordered list of items drawn between the title block and the page footer,
 * text blocks and system sections, with the document options. Schema 1 bodies keep meaning what they meant: `layoutOf` turns
 * them into the layout the code drew before.
 */

export const MAX_LAYOUT_ITEMS = 60;
export const MAX_LAYOUT_BLOCKS = 40;
export const MAX_TITLE = 120;
export const MAX_COLUMN_LABEL = 40;
/** A signature heading or caption; room for a merge variable, as in "For and on behalf of {{tenant.legalName}}". */
export const MAX_OPTION_LABEL = 120;
export const MAX_INDENT = 3;

export const PAGE_HEADERS = ["first", "every"] as const;
export const PAGE_FOOTERS = ["number", "letterhead"] as const;
export const VISITS_FORMATS = ["number", "times_per_year"] as const;
export const AGREEMENT_SECTION_KEYS = ["price", "schedule", "included", "equipment", "terms"] as const;
export const CONTRACT_SECTION_KEYS = ["price", "schedule", "included", "equipment", "signatures"] as const;

export type PageHeader = (typeof PAGE_HEADERS)[number];
export type PageFooter = (typeof PAGE_FOOTERS)[number];
export type VisitsFormat = (typeof VISITS_FORMATS)[number];

/** The title (merge variables allowed), whether the number, customer, site and term lines print, and the repeated letterhead and footer. */
export type DocOptions = { title: string; showMeta: boolean; pageHeader: PageHeader; pageFooter: PageFooter };

export type PriceColumns = { description: string; visits: string; perVisit: string; perYear: string; total: string };
export const PRICE_COLUMN_KEYS = ["description", "visits", "perVisit", "perYear", "total"] as const satisfies readonly (keyof PriceColumns)[];

export type PriceOptions = { title?: string; columns?: PriceColumns; visitsFormat?: VisitsFormat };
export type IncludedOptions = { title?: string; showFrequency?: boolean; uppercase?: boolean };
export type TitleOptions = { title?: string };
/** `heading` is never stored: a schema 1 contract is drawn with the "Signatures" title it always had (block-editor AC 25). */
export type SignatureOptions = { customerLabel?: string; contractorLabel?: string; caption?: string; nameField?: boolean; heading?: string };
export type SectionOptions = PriceOptions | IncludedOptions | TitleOptions | SignatureOptions;

export type BlockItem = { kind: "block"; type: BlockType; text: string; level?: 1 | 2; indent?: 0 | 1 | 2 | 3; pageBreakBefore?: boolean };
export type SectionItem =
  | { kind: "section"; key: "price"; options?: PriceOptions }
  | { kind: "section"; key: "included"; options?: IncludedOptions }
  | { kind: "section"; key: "schedule" | "equipment"; options?: TitleOptions }
  | { kind: "section"; key: "terms" }
  | { kind: "section"; key: "signatures"; options?: SignatureOptions };
export type LayoutItem = BlockItem | SectionItem;
export type SectionKey = SectionItem["key"];

/** What a version of a template with schema 2 holds for the part both documents share. */
export type LayoutBody = { doc: DocOptions; layout: LayoutItem[] };

export const DEFAULT_AGREEMENT_DOC: DocOptions = { title: "Preventive maintenance service agreement", showMeta: true, pageHeader: "first", pageFooter: "number" };

const block = (b: { type: BlockType; text: string }): BlockItem => ({ kind: "block", type: b.type, text: b.text });
const section = (key: "price" | "schedule" | "included" | "equipment" | "terms"): SectionItem => ({ kind: "section", key });

/**
 * The layout of a schema 1 body: the intro, the price table, the visit schedule when shown, the service included and the equipment
 * when the scope shows, the terms, then the closing text. Also the shape the documents are built from for an old body.
 */
export function legacyLayout(
  intro: readonly { type: BlockType; text: string }[],
  footer: readonly { type: BlockType; text: string }[],
  sections: { schedule: boolean; scope: boolean },
): LayoutItem[] {
  return [
    ...intro.map(block),
    section("price"),
    ...(sections.schedule ? [section("schedule")] : []),
    ...(sections.scope ? [section("included"), section("equipment")] : []),
    section("terms"),
    ...footer.map(block),
  ];
}

/** An agreement body's layout and document options: schema 1 as the code drew it before, schema 2 as stored. */
export function layoutOf(body: AgreementTemplateBody): LayoutBody {
  if (body.schema === 2) return { doc: body.doc, layout: body.layout };
  return { doc: { ...DEFAULT_AGREEMENT_DOC }, layout: legacyLayout(body.intro, body.footer, body.sections) };
}

/** Whether a layout draws the section. */
export const hasSection = (layout: readonly LayoutItem[], key: SectionKey) => layout.some((item) => item.kind === "section" && item.key === key);

/** The options of a section in a layout, `undefined` when it has none or is absent. Read as the options type of that key. */
export function sectionOptions(layout: readonly LayoutItem[], key: SectionKey): SectionOptions | undefined {
  const item = layout.find((candidate) => candidate.kind === "section" && candidate.key === key);
  return item && item.kind === "section" && "options" in item ? item.options : undefined;
}

/** The text blocks before the first section and after the last, as a schema 1 reader of a layout sees its intro and closing text. */
export function introAndFooter(layout: readonly LayoutItem[]): { intro: { type: BlockType; text: string }[]; footer: { type: BlockType; text: string }[] } {
  const first = layout.findIndex((item) => item.kind === "section");
  let last = -1;
  layout.forEach((item, index) => {
    if (item.kind === "section") last = index;
  });
  const plain = (items: readonly LayoutItem[]) => items.flatMap((item) => (item.kind === "block" ? [{ type: item.type, text: item.text }] : []));
  if (first === -1) return { intro: plain(layout), footer: [] };
  return { intro: plain(layout.slice(0, first)), footer: plain(layout.slice(last + 1)) };
}

/** The shown-section flags of the schema 1 reading of a layout. */
export const sectionFlags = (layout: readonly LayoutItem[]) => ({
  schedule: hasSection(layout, "schedule"),
  scope: hasSection(layout, "included") || hasSection(layout, "equipment"),
});

const fillText = (text: string, values: TemplateValues) => fillVariables(text, values).text;

function fillOptions<T extends SectionItem>(item: T, values: TemplateValues): T {
  if (!("options" in item) || item.options === undefined) return item;
  const filled: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(item.options as Record<string, unknown>)) {
    if (typeof value === "string" && name !== "visitsFormat") {
      const text = fillText(value, values);
      // A label that fills to nothing is not drawn as an empty heading; the default stands.
      if (text.trim() !== "") filled[name] = text;
    } else if (name === "columns" && typeof value === "object" && value !== null) {
      filled[name] = Object.fromEntries(Object.entries(value).map(([key, label]) => [key, fillText(String(label), values)]));
    } else {
      filled[name] = value;
    }
  }
  return { ...item, options: filled } as T;
}

/**
 * Fills the variables of a schema 2 layout: a clause with a missing value is left out (an unset term states nothing), a heading
 * whose clauses all went is left out with them, a heading or paragraph prints a missing variable as nothing, and the texts of
 * the section options are filled the same way. Values are inserted as they are and never read for variables again.
 */
export function renderLayout(layout: readonly LayoutItem[], values: TemplateValues): LayoutItem[] {
  const filled = layout.map((item): LayoutItem | null => {
    if (item.kind === "section") return fillOptions(item, values);
    const { text, missing } = fillVariables(item.text, values);
    return item.type === "clause" && missing ? null : { ...item, text };
  });
  return filled.filter((item, index): item is LayoutItem => {
    if (item === null) return false;
    if (item.kind !== "block" || item.type !== "heading") return true;
    let clauses = 0;
    let kept = 0;
    for (let next = index + 1; next < layout.length; next += 1) {
      const original = layout[next];
      if (original.kind !== "block" || original.type === "heading") break;
      if (original.type === "clause") clauses += 1;
      if (filled[next] !== null) kept += 1;
    }
    return !(clauses > 0 && kept === 0);
  });
}

export type LayoutError = { field: string; message: string };

/** What a document's layout may hold: its section keys and those that must appear exactly once. */
export type LayoutSpec = { sections: readonly SectionKey[]; required: readonly SectionKey[]; noun: "agreement" | "contract" };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const unknownKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).filter((key) => !allowed.includes(key));
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

const OPTION_KEYS: Record<SectionKey, readonly string[]> = {
  price: ["title", "columns", "visitsFormat"],
  included: ["title", "showFrequency", "uppercase"],
  equipment: ["title"],
  schedule: ["title"],
  terms: [],
  signatures: ["customerLabel", "contractorLabel", "caption", "nameField"],
};

function checkText(field: string, label: string, value: unknown, max: number, errors: LayoutError[], min = 1): void {
  if (typeof value !== "string") {
    errors.push({ field, message: `${label} must be text.` });
  } else if (value.trim().length < min) {
    errors.push({ field, message: `${label} is empty.` });
  } else if (value.length > max) {
    errors.push({ field, message: `${label} is too long (${value.length} characters, at most ${max}).` });
  } else {
    const unknown = unknownVariable(value);
    if (unknown !== null) errors.push({ field, message: `${label} uses an unknown variable: ${unknown}.` });
  }
}

function checkOptions(key: SectionKey, value: unknown, at: string, n: number, errors: LayoutError[]): void {
  const field = `${at}.options`;
  const label = `The ${key} section of item ${n}`;
  if (!isRecord(value)) {
    errors.push({ field, message: `${label} has options that are not an object.` });
    return;
  }
  const extra = unknownKeys(value, OPTION_KEYS[key]);
  if (extra.length > 0) {
    errors.push({ field, message: `${label} has an unknown option: ${extra[0]}.` });
    return;
  }
  for (const [name, option] of Object.entries(value)) {
    const where = `${field}.${name}`;
    if (name === "title" || name === "customerLabel" || name === "contractorLabel" || name === "caption") {
      checkText(where, `The ${name} of ${label.toLowerCase()}`, option, name === "title" ? MAX_TITLE : MAX_OPTION_LABEL, errors);
    } else if (name === "showFrequency" || name === "uppercase" || name === "nameField") {
      if (typeof option !== "boolean") errors.push({ field: where, message: `The ${name} option of item ${n} must be true or false.` });
    } else if (name === "visitsFormat") {
      if (!(VISITS_FORMATS as readonly unknown[]).includes(option)) errors.push({ field: where, message: `The visits format of item ${n} must be number or times_per_year, not ${String(option)}.` });
    } else if (name === "columns") {
      if (!isRecord(option) || unknownKeys(option, PRICE_COLUMN_KEYS).length > 0 || PRICE_COLUMN_KEYS.some((column) => !(column in option))) {
        errors.push({ field: where, message: `The columns of item ${n} must name description, visits, perVisit, perYear and total.` });
      } else {
        for (const column of PRICE_COLUMN_KEYS) checkText(`${where}.${column}`, `The ${column} column label of item ${n}`, option[column], MAX_COLUMN_LABEL, errors);
      }
    }
  }
}

function checkBlockItem(item: Record<string, unknown>, at: string, n: number, errors: LayoutError[]): void {
  const extra = unknownKeys(item, ["kind", "type", "text", "level", "indent", "pageBreakBefore"]);
  if (extra.length > 0) errors.push({ field: at, message: `Item ${n} has an unknown key: ${extra[0]}.` });
  if (!(BLOCK_TYPES as readonly unknown[]).includes(item.type)) {
    errors.push({ field: `${at}.type`, message: `Item ${n} has an unknown block type: ${String(item.type)}.` });
  }
  checkText(`${at}.text`, `Item ${n}`, item.text, MAX_TEXT, errors);
  if ("level" in item && (item.type !== "heading" || !isWhole(item.level) || item.level < 1 || item.level > 2)) {
    errors.push({ field: `${at}.level`, message: `Item ${n} has a heading level of ${String(item.level)}; use 1 or 2, on a heading only.` });
  }
  if ("indent" in item && (!isWhole(item.indent) || item.indent < 0 || item.indent > MAX_INDENT)) {
    errors.push({ field: `${at}.indent`, message: `Item ${n} has an indent of ${String(item.indent)}; use 0 to ${MAX_INDENT}.` });
  }
  if ("pageBreakBefore" in item && typeof item.pageBreakBefore !== "boolean") {
    errors.push({ field: `${at}.pageBreakBefore`, message: `Item ${n} must say true or false for a page break.` });
  }
}

/**
 * The rules of the document options and the layout both documents share (block-editor door 1): the four options, at most 60
 * items and 40 blocks, known item kinds, section keys and options, each section at most once, the required ones exactly once,
 * the text limits and the variable whitelist. Every problem comes back with the field it belongs to and its own message.
 */
export function validateLayout(input: { doc: unknown; layout: unknown }, spec: LayoutSpec): LayoutError[] {
  const errors: LayoutError[] = [];
  const { doc, layout } = input;

  if (!isRecord(doc)) {
    errors.push({ field: "doc", message: "The document options are missing." });
  } else {
    const extra = unknownKeys(doc, ["title", "showMeta", "pageHeader", "pageFooter"]);
    if (extra.length > 0) errors.push({ field: "doc", message: `The document options have an unknown key: ${extra[0]}.` });
    if (typeof doc.title === "string" && doc.title.length > MAX_TITLE) {
      errors.push({ field: "doc.title", message: `The title is too long (${doc.title.length} characters, at most ${MAX_TITLE}).` });
    } else if (typeof doc.title !== "string") {
      errors.push({ field: "doc.title", message: "The title must be text." });
    } else {
      const unknown = unknownVariable(doc.title);
      if (unknown !== null) errors.push({ field: "doc.title", message: `The title uses an unknown variable: ${unknown}.` });
    }
    if (typeof doc.showMeta !== "boolean") errors.push({ field: "doc.showMeta", message: "Show the number, customer and site lines must be true or false." });
    if (!(PAGE_HEADERS as readonly unknown[]).includes(doc.pageHeader)) {
      errors.push({ field: "doc.pageHeader", message: `The page header must be first or every, not ${String(doc.pageHeader)}.` });
    }
    if (!(PAGE_FOOTERS as readonly unknown[]).includes(doc.pageFooter)) {
      errors.push({ field: "doc.pageFooter", message: `The page footer must be number or letterhead, not ${String(doc.pageFooter)}.` });
    }
  }

  if (!Array.isArray(layout)) {
    errors.push({ field: "layout", message: "The layout is not a list." });
    return errors;
  }
  if (layout.length > MAX_LAYOUT_ITEMS) {
    errors.push({ field: "layout", message: `The layout has too many items (${layout.length}, at most ${MAX_LAYOUT_ITEMS}).` });
    return errors;
  }

  const seen = new Set<string>();
  let blocks = 0;
  for (const [index, item] of layout.entries()) {
    const at = `layout.${index}`;
    const n = index + 1;
    if (!isRecord(item)) {
      errors.push({ field: at, message: `Item ${n} is not an object.` });
    } else if (item.kind === "block") {
      blocks += 1;
      checkBlockItem(item, at, n, errors);
    } else if (item.kind === "section") {
      const extra = unknownKeys(item, ["kind", "key", "options"]);
      if (extra.length > 0) errors.push({ field: at, message: `Item ${n} has an unknown key: ${extra[0]}.` });
      const key = item.key;
      if (typeof key !== "string" || !(spec.sections as readonly string[]).includes(key)) {
        errors.push({ field: `${at}.key`, message: `Item ${n} is a section this ${spec.noun} does not have: ${String(key)}.` });
      } else if (seen.has(key)) {
        errors.push({
          field: at,
          message: key === "price" ? `The price table is in the layout more than once (item ${n}); keep one.` : `The ${key} section is in the layout more than once (item ${n}).`,
        });
      } else {
        seen.add(key);
        if ("options" in item) checkOptions(key as SectionKey, item.options, at, n, errors);
      }
    } else {
      errors.push({ field: `${at}.kind`, message: `Item ${n} has an unknown kind: ${String(item.kind)}.` });
    }
  }
  if (blocks > MAX_LAYOUT_BLOCKS) {
    errors.push({ field: "layout", message: `The layout has too many text blocks (${blocks}, at most ${MAX_LAYOUT_BLOCKS}).` });
  }
  for (const key of spec.required) {
    if (!seen.has(key)) {
      errors.push({ field: "layout", message: key === "price" ? "The layout needs the price table." : `The layout needs the ${key} section.` });
    }
  }
  return errors;
}
