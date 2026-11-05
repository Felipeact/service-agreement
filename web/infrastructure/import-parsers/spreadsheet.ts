import * as XLSX from "xlsx";
import { MAX_IMPORT_ROWS } from "@/domain/imports";
import type { ParseResult, ParsedTable } from "@/application/ports";

/** A header must sit in the first 20 rows of a sheet (plan Assumptions). */
const HEADER_WINDOW = 20;

/** Enough rows for a header in row 20 plus one row past the cap; a longer sheet is never loaded whole. */
const SHEET_ROWS = HEADER_WINDOW + MAX_IMPORT_ROWS + 2;

/** Text that a spreadsheet or CSV would treat as a number or a date: never a column heading. */
const NUMBER_LIKE = /^[-+]?[$€£]?\s*\d[\d\s,.]*%?$/;
const DATE_LIKE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;

type Cell = XLSX.CellObject | undefined;

const textOf = (cell: Cell) => (cell?.w ?? (cell?.v == null ? "" : String(cell.v))).trim();

function isHeading(cell: Cell): boolean {
  if (!cell || cell.t !== "s") return false;
  const text = textOf(cell);
  return !NUMBER_LIKE.test(text) && !DATE_LIKE.test(text);
}

type SheetRead = { table: ParsedTable | null; truncated: boolean };

/** The sheet's table: the first heading row in the window with a data row below it, and every non-empty row after it. */
function readSheet(sheet: XLSX.WorkSheet, source: string): SheetRead {
  if (!sheet["!ref"]) return { table: null, truncated: false };
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const full = sheet["!fullref"] ? XLSX.utils.decode_range(sheet["!fullref"]) : range;
  const truncated = full.e.r > range.e.r;

  const rows: { number: number; cells: Cell[] }[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: Cell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) cells.push(sheet[XLSX.utils.encode_cell({ r, c })] as Cell);
    rows.push({ number: r + 1, cells });
  }
  const filled = (cells: Cell[]) => cells.some((cell) => textOf(cell) !== "");

  for (let i = 0; i < rows.length && rows[i].number <= HEADER_WINDOW; i++) {
    const nonEmpty = rows[i].cells.filter((cell) => textOf(cell) !== "");
    if (nonEmpty.length < 2 || !nonEmpty.every(isHeading)) continue;
    const data = rows.slice(i + 1).filter((row) => filled(row.cells));
    if (data.length === 0) continue;
    return {
      truncated,
      table: {
        source,
        header: rows[i].cells.map(textOf),
        rows: data.map((row) => ({ ref: `${source}!${row.number}`, cells: row.cells.map(textOf) })),
      },
    };
  }
  return { table: null, truncated };
}

/** Every visible sheet's table, in workbook order, or why there is none. */
function tablesOf(book: XLSX.WorkBook, sourceOf: (name: string) => string): ParseResult {
  const tables: ParsedTable[] = [];
  for (const [index, name] of book.SheetNames.entries()) {
    if (book.Workbook?.Sheets?.[index]?.Hidden) continue;
    const { table, truncated } = readSheet(book.Sheets[name], sourceOf(name));
    if (!table) continue;
    if (truncated) return { ok: false, reason: "too_many_rows" };
    tables.push(table);
  }
  if (tables.length === 0) return { ok: false, reason: "no_table" };
  if (tables.reduce((sum, table) => sum + table.rows.length, 0) > MAX_IMPORT_ROWS) return { ok: false, reason: "too_many_rows" };
  return { ok: true, parsed: { format: "table", tables, text: "" } };
}

export function readXlsx(bytes: Uint8Array): ParseResult {
  let book: XLSX.WorkBook;
  try {
    // cellNF keeps each cell's number format, so a date shows as Excel shows it and is never taken for a heading.
    book = XLSX.read(bytes, { type: "array", cellNF: true, sheetRows: SHEET_ROWS });
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  return tablesOf(book, (name) => name);
}

/** UTF-8 when the bytes are valid UTF-8 (a BOM is dropped), otherwise Windows-1252, as Excel saves "CSV" on Windows. */
function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function readCsv(bytes: Uint8Array): ParseResult {
  if (bytes.includes(0)) return { ok: false, reason: "corrupt" };
  let book: XLSX.WorkBook;
  try {
    // raw keeps every value as typed ("0042" stays text); SheetJS picks the delimiter (",", ";" or tab).
    book = XLSX.read(decodeCsv(bytes), { type: "string", raw: true, sheetRows: SHEET_ROWS });
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  return tablesOf(book, () => "CSV");
}
