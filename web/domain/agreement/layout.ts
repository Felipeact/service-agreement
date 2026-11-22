import { BLOCK_TYPES, fillVariables, MAX_TEXT, unknownVariable, type BlockType, type TemplateValues } from "../contract/template";
import type { AgreementTemplateBody } from "./template";
import { isRecord, isWhole, unknownKeys } from "../guards";

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

export const LOGO_SIZES = ["small", "medium", "large"] as const;
export const HEADER_ALIGNS = ["left", "center"] as const;
export type LogoSize = (typeof LOGO_SIZES)[number];
export type HeaderAlign = (typeof HEADER_ALIGNS)[number];

/** What the letterhead shows and how: the logo and its size, which company details print, and where they sit. */
export type LetterheadOptions = { logo: boolean; logoSize: LogoSize; align: HeaderAlign; name: boolean; address: boolean; phone: boolean };
export const LETTERHEAD_FLAGS = ["logo", "name", "address", "phone"] as const satisfies readonly (keyof LetterheadOptions)[];

/** The letterhead every document drew before it could be edited: logo (when the company has one), name, address and phone, on the left. */
export const DEFAULT_LETTERHEAD: LetterheadOptions = { logo: true, logoSize: "medium", align: "left", name: true, address: true, phone: true };

export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

/** How a text block is set: its alignment and weight. Absent means the plain look every block had before styling. */
export type BlockStyle = { align?: TextAlign; bold?: boolean; italic?: boolean };
export const BLOCK_STYLE_KEYS = ["align", "bold", "italic"] as const satisfies readonly (keyof BlockStyle)[];

/** The document's own colour and type, set per template. Absent means the company's accent colour and the sans face. */
export const THEME_ACCENTS = {
  blue: "#2563eb",
  teal: "#0f766e",
  amber: "#b45309",
  violet: "#6d28d9",
  rose: "#be123c",
  slate: "#334155",
} as const;
export type ThemeAccent = keyof typeof THEME_ACCENTS;
export const THEME_ACCENT_KEYS = Object.keys(THEME_ACCENTS) as ThemeAccent[];
export const THEME_FONTS = ["sans", "serif"] as const;
export type ThemeFont = (typeof THEME_FONTS)[number];
export type Theme = { accent?: ThemeAccent; font?: ThemeFont };

/** A table of free text: its header row (when `header`), then the rest, every row the same width. Cells may hold merge variables. */
export const TABLE_MAX_ROWS = 12;
export const TABLE_MAX_COLUMNS = 5;
export const MAX_CELL = 120;
export type TableItem = { kind: "table"; header: boolean; rows: string[][] };

/**
 * The title (merge variables allowed), whether the number, customer, site and term lines print, and the repeated letterhead and
 * footer. `letterhead` is how the header looks; a document without it draws `DEFAULT_LETTERHEAD`.
 */
export type DocOptions = { title: string; showMeta: boolean; pageHeader: PageHeader; pageFooter: PageFooter; letterhead?: LetterheadOptions; theme?: Theme };

/** The letterhead options of a document, the default for the parts it does not say. */
export const letterheadOf = (doc: Pick<DocOptions, "letterhead">): LetterheadOptions => ({ ...DEFAULT_LETTERHEAD, ...doc.letterhead });

/** Why a letterhead value cannot be stored, `null` when it can. */
export function letterheadProblem(value: unknown): string | null {
  if (!isRecordLike(value)) return "The letterhead options must be an object.";
  const extra = Object.keys(value).filter((key) => ![...LETTERHEAD_FLAGS, "logoSize", "align"].includes(key));
  if (extra.length > 0) return `The letterhead options have an unknown key: ${extra[0]}.`;
  for (const flag of LETTERHEAD_FLAGS) if (typeof value[flag] !== "boolean") return `Letterhead ${flag} must be true or false.`;
  if (!(LOGO_SIZES as readonly unknown[]).includes(value.logoSize)) return "The logo size must be small, medium or large.";
  if (!(HEADER_ALIGNS as readonly unknown[]).includes(value.align)) return "The letterhead alignment must be left or center.";
  return null;
}
const isRecordLike = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export type PriceColumns = { description: string; visits: string; perVisit: string; perYear: string; total: string };
export const PRICE_COLUMN_KEYS = ["description", "visits", "perVisit", "perYear", "total"] as const satisfies readonly (keyof PriceColumns)[];

export type PriceOptions = { title?: string; columns?: PriceColumns; visitsFormat?: VisitsFormat };
export type IncludedOptions = { title?: string; showFrequency?: boolean; uppercase?: boolean };
export type TitleOptions = { title?: string };
/** `heading` is never stored: a schema 1 contract is drawn with the "Signatures" title it always had (block-editor AC 25). */
export type SignatureOptions = { customerLabel?: string; contractorLabel?: string; caption?: string; nameField?: boolean; heading?: string };
export type SectionOptions = PriceOptions | IncludedOptions | TitleOptions | SignatureOptions;

export type BlockItem = { kind: "block"; type: BlockType; text: string; level?: 1 | 2; indent?: 0 | 1 | 2 | 3; pageBreakBefore?: boolean; style?: BlockStyle };
export type SectionItem =
  | { kind: "section"; key: "price"; options?: PriceOptions }
  | { kind: "section"; key: "included"; options?: IncludedOptions }
  | { kind: "section"; key: "schedule" | "equipment"; options?: TitleOptions }
  | { kind: "section"; key: "terms" }
  | { kind: "section"; key: "signatures"; options?: SignatureOptions };
export type LayoutItem = BlockItem | SectionItem | TableItem;
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

/** The accent colour a document draws in: its template's theme, else the company's own. */
export const accentOf = (doc: Pick<DocOptions, "theme">, tenantAccent: string): string => (doc.theme?.accent ? THEME_ACCENTS[doc.theme.accent] : tenantAccent);

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
    if (item.kind === "table") return { ...item, rows: item.rows.map((row) => row.map((cell) => fillText(cell, values))) };
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

/** Why a block's style cannot be stored, as messages; empty when it can. */
function checkStyle(value: unknown, at: string, n: number, errors: LayoutError[]): void {
  if (!isRecord(value)) {
    errors.push({ field: `${at}.style`, message: `Item ${n} has a style that is not an object.` });
    return;
  }
  const extra = unknownKeys(value, BLOCK_STYLE_KEYS);
  if (extra.length > 0) errors.push({ field: `${at}.style`, message: `Item ${n} has an unknown style option: ${extra[0]}.` });
  if ("align" in value && !(TEXT_ALIGNS as readonly unknown[]).includes(value.align)) errors.push({ field: `${at}.style.align`, message: `Item ${n} must align left, center or right.` });
  for (const flag of ["bold", "italic"] as const) {
    if (flag in value && typeof value[flag] !== "boolean") errors.push({ field: `${at}.style.${flag}`, message: `Item ${n} must say true or false for ${flag}.` });
  }
}

function checkTable(item: Record<string, unknown>, at: string, n: number, errors: LayoutError[]): void {
  const extra = unknownKeys(item, ["kind", "header", "rows"]);
  if (extra.length > 0) errors.push({ field: at, message: `Item ${n} has an unknown key: ${extra[0]}.` });
  if (typeof item.header !== "boolean") errors.push({ field: `${at}.header`, message: `Table ${n} must say true or false for its header row.` });
  const rows = item.rows;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > TABLE_MAX_ROWS) {
    errors.push({ field: `${at}.rows`, message: `Table ${n} needs 1 to ${TABLE_MAX_ROWS} rows.` });
    return;
  }
  const width = Array.isArray(rows[0]) ? rows[0].length : 0;
  if (width < 1 || width > TABLE_MAX_COLUMNS) {
    errors.push({ field: `${at}.rows`, message: `Table ${n} needs 1 to ${TABLE_MAX_COLUMNS} columns.` });
    return;
  }
  for (const [r, row] of rows.entries()) {
    if (!Array.isArray(row) || row.length !== width) {
      errors.push({ field: `${at}.rows.${r}`, message: `Every row of table ${n} must have ${width} cells.` });
      continue;
    }
    for (const [c, cell] of row.entries()) {
      if (typeof cell !== "string") errors.push({ field: `${at}.rows.${r}.${c}`, message: `A cell of table ${n} must be text.` });
      else if (cell.length > MAX_CELL) errors.push({ field: `${at}.rows.${r}.${c}`, message: `A cell of table ${n} is too long (${cell.length} characters, at most ${MAX_CELL}).` });
      else {
        const unknown = unknownVariable(cell);
        if (unknown !== null) errors.push({ field: `${at}.rows.${r}.${c}`, message: `A cell of table ${n} uses an unknown variable: ${unknown}.` });
      }
    }
  }
}

function checkTheme(value: unknown, errors: LayoutError[]): void {
  if (!isRecord(value)) {
    errors.push({ field: "doc.theme", message: "The theme must be an object." });
    return;
  }
  const extra = unknownKeys(value, ["accent", "font"]);
  if (extra.length > 0) errors.push({ field: "doc.theme", message: `The theme has an unknown key: ${extra[0]}.` });
  if ("accent" in value && !(THEME_ACCENT_KEYS as readonly unknown[]).includes(value.accent)) errors.push({ field: "doc.theme.accent", message: `The accent colour must be one of ${THEME_ACCENT_KEYS.join(", ")}.` });
  if ("font" in value && !(THEME_FONTS as readonly unknown[]).includes(value.font)) errors.push({ field: "doc.theme.font", message: "The font must be sans or serif." });
}

function checkBlockItem(item: Record<string, unknown>, at: string, n: number, errors: LayoutError[]): void {
  const extra = unknownKeys(item, ["kind", "type", "text", "level", "indent", "pageBreakBefore", "style"]);
  if ("style" in item && item.style !== undefined) checkStyle(item.style, at, n, errors);
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
    const extra = unknownKeys(doc, ["title", "showMeta", "pageHeader", "pageFooter", "letterhead", "theme"]);
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
    if ("letterhead" in doc && doc.letterhead !== undefined) {
      const problem = letterheadProblem(doc.letterhead);
      if (problem !== null) errors.push({ field: "doc.letterhead", message: problem });
    }
    if ("theme" in doc && doc.theme !== undefined) checkTheme(doc.theme, errors);
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
    } else if (item.kind === "table") {
      checkTable(item, at, n, errors);
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
