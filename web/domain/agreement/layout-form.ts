import { BLOCK_TYPES, type BlockType } from "../contract/template";
import {
  MAX_INDENT,
  PAGE_FOOTERS,
  PAGE_HEADERS,
  PRICE_COLUMN_KEYS,
  VISITS_FORMATS,
  type BlockItem,
  type DocOptions,
  type LayoutItem,
  type PriceColumns,
  type SectionItem,
  type SectionKey,
  type SignatureOptions,
  type VisitsFormat,
} from "./layout";

/**
 * The block editor's form state (block-editor Landing row 7): the document options and one row per layout item, every option held
 * as the member typed it, so a half-typed label or an empty text is kept and flagged instead of lost.
 */

export type BlockRow = { kind: "block"; type: BlockType; text: string; level: 1 | 2; indent: 0 | 1 | 2 | 3; pageBreakBefore: boolean };

/** A section row holds the options of every section; the ones its key has no use for stay at their empty value and are not stored. */
export type SectionRow = {
  kind: "section";
  key: SectionKey;
  title: string;
  /** All five empty means the default labels. */
  columns: PriceColumns;
  visitsFormat: VisitsFormat;
  showFrequency: boolean;
  uppercase: boolean;
  customerLabel: string;
  contractorLabel: string;
  caption: string;
  nameField: boolean;
};

export type LayoutRow = BlockRow | SectionRow;

/** The part of a form both documents share. */
export type LayoutFormState = { doc: DocOptions; layout: LayoutRow[] };

/** A field-level message as a preview route answers it. */
export type LayoutFieldError = { field: string; message: string };

const EMPTY_COLUMNS: PriceColumns = { description: "", visits: "", perVisit: "", perYear: "", total: "" };

export function newBlockRow(type: BlockType): BlockRow {
  return { kind: "block", type, text: "", level: 2, indent: 0, pageBreakBefore: false };
}

export function newSectionRow(key: SectionKey): SectionRow {
  return {
    kind: "section",
    key,
    title: "",
    columns: { ...EMPTY_COLUMNS },
    visitsFormat: "number",
    showFrequency: false,
    uppercase: false,
    customerLabel: "",
    contractorLabel: "",
    caption: "",
    nameField: false,
  };
}

function rowFromItem(item: LayoutItem): LayoutRow[] {
  if (item.kind === "block") {
    return [{ kind: "block", type: item.type, text: item.text, level: item.level ?? 2, indent: item.indent ?? 0, pageBreakBefore: item.pageBreakBefore === true }];
  }
  const row = newSectionRow(item.key);
  const options = (item.key === "terms" ? undefined : item.options) as Record<string, unknown> | undefined;
  if (!options) return [row];
  if (typeof options.title === "string") row.title = options.title;
  if (options.columns && typeof options.columns === "object") row.columns = { ...EMPTY_COLUMNS, ...(options.columns as Partial<PriceColumns>) };
  if (options.visitsFormat === "times_per_year") row.visitsFormat = "times_per_year";
  row.showFrequency = options.showFrequency === true;
  row.uppercase = options.uppercase === true;
  row.nameField = options.nameField === true;
  for (const key of ["customerLabel", "contractorLabel", "caption"] as const) {
    const value = (options as SignatureOptions)[key];
    if (typeof value === "string") row[key] = value;
  }
  // A schema 1 contract draws a "Signatures" title above the blocks; as a row it is the heading block it always looked like.
  if (typeof options.heading === "string") return [{ ...newBlockRow("heading"), text: options.heading }, row];
  return [row];
}

/** The rows of a layout, one for each item (and a heading row for the title of a schema 1 contract's signatures). */
export const rowsFromLayout = (layout: readonly LayoutItem[]): LayoutRow[] => layout.flatMap(rowFromItem);

function itemFromRow(row: LayoutRow): LayoutItem {
  if (row.kind === "block") {
    const item: BlockItem = { kind: "block", type: row.type, text: row.text.trim() };
    if (row.type === "heading" && row.level === 1) item.level = 1;
    if (row.indent > 0) item.indent = row.indent;
    if (row.pageBreakBefore) item.pageBreakBefore = true;
    return item;
  }
  const title = row.title.trim();
  switch (row.key) {
    case "price": {
      const labels = PRICE_COLUMN_KEYS.map((key) => row.columns[key].trim());
      const options: Extract<SectionItem, { key: "price" }>["options"] = {};
      if (title !== "") options.title = title;
      if (labels.some((label) => label !== "")) options.columns = Object.fromEntries(PRICE_COLUMN_KEYS.map((key, at) => [key, labels[at]])) as PriceColumns;
      if (row.visitsFormat === "times_per_year") options.visitsFormat = "times_per_year";
      return Object.keys(options).length > 0 ? { kind: "section", key: "price", options } : { kind: "section", key: "price" };
    }
    case "included": {
      const options: Extract<SectionItem, { key: "included" }>["options"] = {};
      if (title !== "") options.title = title;
      if (row.showFrequency) options.showFrequency = true;
      if (row.uppercase) options.uppercase = true;
      return Object.keys(options).length > 0 ? { kind: "section", key: "included", options } : { kind: "section", key: "included" };
    }
    case "schedule":
    case "equipment":
      return title !== "" ? { kind: "section", key: row.key, options: { title } } : { kind: "section", key: row.key };
    case "terms":
      return { kind: "section", key: "terms" };
    case "signatures": {
      const options: SignatureOptions = {};
      for (const key of ["customerLabel", "contractorLabel", "caption"] as const) {
        if (row[key].trim() !== "") options[key] = row[key].trim();
      }
      if (row.nameField) options.nameField = true;
      return Object.keys(options).length > 0 ? { kind: "section", key: "signatures", options } : { kind: "section", key: "signatures" };
    }
  }
}

/** The layout of the rows, one item for each, in order: the body's `layout`. */
export const layoutFromRows = (rows: readonly LayoutRow[]): LayoutItem[] => rows.map(itemFromRow);

/** The rows in `layout.<n>` order, so a validator field name names the row it is about. */
export function messagesByRow(errors: Record<string, string> | readonly LayoutFieldError[]): Map<number, string[]> {
  const entries = Array.isArray(errors) ? errors.map(({ field, message }) => [field, message] as const) : Object.entries(errors as Record<string, string>);
  const byRow = new Map<number, string[]>();
  for (const [field, message] of entries) {
    const match = /^layout\.(\d+)(?:\.|$)/.exec(field);
    if (!match) continue;
    const at = Number(match[1]);
    byRow.set(at, [...(byRow.get(at) ?? []), message]);
  }
  return byRow;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const SECTION_KEYS: readonly string[] = ["price", "schedule", "included", "equipment", "terms", "signatures"];

/**
 * The document options and rows of a posted JSON value, every field the right type; anything else is one error naming where it
 * went wrong. How many rows there are and what they say is the validator's to judge, not this reader's.
 */
export function readLayoutFormState(value: Record<string, unknown>): { ok: true; state: LayoutFormState } | { ok: false; errors: LayoutFieldError[] } {
  const bad = (field: string, message: string) => ({ ok: false as const, errors: [{ field, message }] });
  const { doc, layout } = value;
  if (!isRecord(doc)) return bad("doc", "The document options must be an object.");
  if (typeof doc.title !== "string") return bad("doc.title", "The title must be text.");
  if (typeof doc.showMeta !== "boolean") return bad("doc.showMeta", "This field must be true or false.");
  if (!(PAGE_HEADERS as readonly unknown[]).includes(doc.pageHeader)) return bad("doc.pageHeader", "The page header must be first or every.");
  if (!(PAGE_FOOTERS as readonly unknown[]).includes(doc.pageFooter)) return bad("doc.pageFooter", "The page footer must be number or letterhead.");
  if (!Array.isArray(layout)) return bad("layout", "The layout must be a list.");

  const rows: LayoutRow[] = [];
  for (const [index, raw] of layout.entries()) {
    const at = `layout.${index}`;
    if (!isRecord(raw)) return bad(at, "Each row must be an object.");
    if (raw.kind === "block") {
      if (!(BLOCK_TYPES as readonly unknown[]).includes(raw.type)) return bad(`${at}.type`, "The block type must be heading, paragraph or clause.");
      if (typeof raw.text !== "string") return bad(`${at}.text`, "The text must be text.");
      if (raw.level !== 1 && raw.level !== 2) return bad(`${at}.level`, "The heading level must be 1 or 2.");
      if (typeof raw.indent !== "number" || !Number.isInteger(raw.indent) || raw.indent < 0 || raw.indent > MAX_INDENT) return bad(`${at}.indent`, `The indent must be 0 to ${MAX_INDENT}.`);
      if (typeof raw.pageBreakBefore !== "boolean") return bad(`${at}.pageBreakBefore`, "The page break must be true or false.");
      rows.push({ kind: "block", type: raw.type as BlockType, text: raw.text, level: raw.level, indent: raw.indent as BlockRow["indent"], pageBreakBefore: raw.pageBreakBefore });
    } else if (raw.kind === "section") {
      if (typeof raw.key !== "string" || !SECTION_KEYS.includes(raw.key)) return bad(`${at}.key`, "This section is not one this product has.");
      const row = newSectionRow(raw.key as SectionKey);
      for (const key of ["title", "customerLabel", "contractorLabel", "caption"] as const) {
        if (typeof raw[key] !== "string") return bad(`${at}.${key}`, "This field must be text.");
        row[key] = raw[key];
      }
      for (const key of ["showFrequency", "uppercase", "nameField"] as const) {
        if (typeof raw[key] !== "boolean") return bad(`${at}.${key}`, "This field must be true or false.");
        row[key] = raw[key];
      }
      if (!(VISITS_FORMATS as readonly unknown[]).includes(raw.visitsFormat)) return bad(`${at}.visitsFormat`, "The visits format must be number or times_per_year.");
      row.visitsFormat = raw.visitsFormat as VisitsFormat;
      if (!isRecord(raw.columns)) return bad(`${at}.columns`, "The column labels must be an object.");
      for (const key of PRICE_COLUMN_KEYS) {
        if (typeof raw.columns[key] !== "string") return bad(`${at}.columns.${key}`, "This field must be text.");
        row.columns[key] = raw.columns[key] as string;
      }
      rows.push(row);
    } else {
      return bad(`${at}.kind`, "Each row must be a block or a section.");
    }
  }
  return { ok: true, state: { doc: { title: doc.title, showMeta: doc.showMeta, pageHeader: doc.pageHeader as DocOptions["pageHeader"], pageFooter: doc.pageFooter as DocOptions["pageFooter"] }, layout: rows } };
}
