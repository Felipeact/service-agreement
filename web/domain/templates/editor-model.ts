import { AGREEMENT_SECTION_KEYS, CONTRACT_SECTION_KEYS, type SectionKey } from "../agreement/layout";
import type { LayoutRow } from "../agreement/layout-form";
import { BLOCK_TYPES, TEMPLATE_VARIABLES, type BlockType, type TemplateVariable } from "../contract/template";

/**
 * The rules of the template editor that decide something (template-editor-v2): which parts a document has, which can never be
 * removed, where a new row goes, and what delete and undo do to the list. Pure, so the screen only draws what these answer.
 */

export type EditorDocument = "agreement" | "contract";

/** What a merge variable is called to the owner, in plain words. Every name on the whitelist has one. */
export const VARIABLE_LABELS: Record<TemplateVariable, string> = {
  "terms.paymentDays": "Payment days",
  "terms.cancellationNoticeDays": "Cancellation notice",
  "terms.repairDiscountPct": "Repair discount",
  "terms.cpiCapPct": "CPI cap",
  "terms.cpiRenegotiationThresholdPct": "CPI renegotiation threshold",
  "terms.renewalNoticeDays": "Renewal notice",
  province: "Province",
  "term.label": "Term length",
  "tenant.legalName": "Your company name",
  "customer.name": "Customer name",
  "site.name": "Site name",
  "term.start": "Start date",
  "tenant.address": "Your address",
  "tenant.phone": "Your phone",
  "signer.name": "Signer name",
  "terms.taxNote": "Tax note",
};

export const VARIABLES: readonly TemplateVariable[] = TEMPLATE_VARIABLES;

/** The label of `{{name}}`, or `null` for a name that is not on the whitelist. */
export const variableLabel = (name: string): string | null => (name in VARIABLE_LABELS ? VARIABLE_LABELS[name as TemplateVariable] : null);

/** The parts a document can have: the sections its renderer draws. */
export const partsOf = (document: EditorDocument): readonly SectionKey[] => (document === "agreement" ? AGREEMENT_SECTION_KEYS : CONTRACT_SECTION_KEYS);

const REQUIRED: Record<EditorDocument, readonly SectionKey[]> = { agreement: ["price"], contract: ["price", "signatures"] };

/** A part that can move but never be removed: the price table, and a contract's signatures. */
export const isRequired = (row: LayoutRow, document: EditorDocument): boolean => row.kind === "section" && REQUIRED[document].includes(row.key);

export const canMove = (rows: readonly LayoutRow[], index: number, by: -1 | 1): boolean => index >= 0 && index < rows.length && index + by >= 0 && index + by < rows.length;

/** The rows with the one at `index` swapped with its neighbour; the same rows when there is no neighbour. */
export function moveRow(rows: LayoutRow[], index: number, by: -1 | 1): LayoutRow[] {
  if (!canMove(rows, index, by)) return rows;
  const next = [...rows];
  [next[index], next[index + by]] = [next[index + by], next[index]];
  return next;
}

/** Where a new row goes: after the selected one; with none selected at the end, but before a final Signatures part. */
export function insertionIndex(rows: readonly LayoutRow[], selected: number | null): number {
  if (selected !== null && selected >= 0 && selected < rows.length) return selected + 1;
  const last = rows[rows.length - 1];
  return last && last.kind === "section" && last.key === "signatures" ? rows.length - 1 : rows.length;
}

export function insertRow(rows: LayoutRow[], selected: number | null, row: LayoutRow): { rows: LayoutRow[]; index: number } {
  const index = insertionIndex(rows, selected);
  return { rows: [...rows.slice(0, index), row, ...rows.slice(index)], index };
}

export type RemovedRow = { row: LayoutRow; index: number };

export function removeRow(rows: LayoutRow[], index: number): { rows: LayoutRow[]; removed: RemovedRow } {
  return { rows: rows.filter((_, at) => at !== index), removed: { row: rows[index], index } };
}

/** Puts a removed row back at its old index, or at the end when the list has since got shorter. */
export function restoreRow(rows: LayoutRow[], removed: RemovedRow): { rows: LayoutRow[]; index: number } {
  const index = Math.min(removed.index, rows.length);
  return { rows: [...rows.slice(0, index), removed.row, ...rows.slice(index)], index };
}

/** The document's parts in their fixed order, each with whether the page already has it. */
export function availableParts(rows: readonly LayoutRow[], document: EditorDocument): { key: SectionKey; onPage: boolean }[] {
  return partsOf(document).map((key) => ({ key, onPage: rows.some((row) => row.kind === "section" && row.key === key) }));
}

/** `{{name}}` put at the caret (replacing a selection), or at the end when the field was never focused. */
export function insertVariable(text: string, caret: { start: number; end: number } | null, name: TemplateVariable): string {
  const token = `{{${name}}}`;
  if (caret === null) return `${text}${token}`;
  const start = Math.min(Math.max(caret.start, 0), text.length);
  const end = Math.min(Math.max(caret.end, start), text.length);
  return `${text.slice(0, start)}${token}${text.slice(end)}`;
}

/** The drop line for a pointer over the block at `overIndex`: before it in its upper half, after it in its lower half. */
export const dropPosition = (overIndex: number, lowerHalf: boolean): number => (lowerHalf ? overIndex + 1 : overIndex);

/** A row put at a drop line (`at` counts rows before the line), held to the ends of the list. */
export function insertRowAt(rows: LayoutRow[], at: number, row: LayoutRow): { rows: LayoutRow[]; index: number } {
  const index = Math.min(Math.max(at, 0), rows.length);
  return { rows: [...rows.slice(0, index), row, ...rows.slice(index)], index };
}

/** A row moved to a drop line; the same rows when the line is where the row already is. `index` is where the row ends up. */
export function moveRowTo(rows: LayoutRow[], from: number, at: number): { rows: LayoutRow[]; index: number } {
  if (from < 0 || from >= rows.length) return { rows, index: from };
  const line = Math.min(Math.max(at, 0), rows.length);
  const target = line > from ? line - 1 : line;
  if (target === from) return { rows, index: from };
  const rest = rows.filter((_, position) => position !== from);
  return { rows: [...rest.slice(0, target), rows[from], ...rest.slice(target)], index: target };
}

/** What a drag carries: an element chosen in the Add Element panel, or a block of the page being moved. */
export type DragPayload = { kind: "add"; choice: { kind: "block"; type: BlockType } | { kind: "part"; key: SectionKey } } | { kind: "move"; from: number };

export const DRAG_TYPE = "application/x-template-editor";

/** What a drop carried, or `null` for anything that is not exactly one of the payloads above (a drop can bring any text from anywhere). */
export function readDragPayload(raw: string): DragPayload | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { kind, choice, from } = value as { kind?: unknown; choice?: { kind?: unknown; type?: unknown; key?: unknown }; from?: unknown };
  if (kind === "move") return typeof from === "number" && Number.isInteger(from) && from >= 0 ? { kind, from } : null;
  if (kind !== "add" || typeof choice !== "object" || choice === null) return null;
  if (choice.kind === "block" && (BLOCK_TYPES as readonly unknown[]).includes(choice.type)) return { kind, choice: { kind: "block", type: choice.type as BlockType } };
  if (choice.kind === "part" && typeof choice.key === "string" && (AGREEMENT_SECTION_KEYS as readonly string[]).concat(CONTRACT_SECTION_KEYS).includes(choice.key)) return { kind, choice: { kind: "part", key: choice.key as SectionKey } };
  return null;
}
