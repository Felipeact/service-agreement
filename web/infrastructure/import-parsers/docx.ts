import mammoth from "mammoth";
import { MAX_IMPORT_ROWS } from "@/domain/imports";
import type { ParseResult, ParsedTable } from "@/application/ports";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") return String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * The top-level tables in mammoth's HTML, each a list of rows of cell texts. A nested table's text joins the outer
 * cell it sits in (plan Assumptions); paragraphs and line breaks inside a cell become spaces.
 */
function htmlTables(html: string): string[][][] {
  const tables: string[][][] = [];
  let depth = 0;
  let cell: string[] | null = null;
  for (const [token, close, tag] of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>|[^<]+/gi)) {
    if (!tag) {
      if (depth > 0 && cell) cell.push(decode(token));
      continue;
    }
    const name = tag.toLowerCase();
    if (name === "table") {
      depth += close ? -1 : 1;
      if (!close && depth === 1) tables.push([]);
    } else if (depth === 1 && !close && name === "tr") {
      tables.at(-1)!.push([]);
    } else if (depth === 1 && !close && (name === "td" || name === "th")) {
      cell = [];
      tables.at(-1)!.at(-1)?.push("");
    } else if (depth === 1 && close && (name === "td" || name === "th")) {
      const row = tables.at(-1)!.at(-1);
      if (row && cell) row[row.length - 1] = clean(cell.join(" "));
      cell = null;
    } else if (depth > 0 && cell && (name === "p" || name === "br")) {
      cell.push(" ");
    }
  }
  return tables;
}

/** A Word table counts when it has at least 2 columns and a data row below its first row, which is its header. */
function toParsed(rows: string[][], n: number): ParsedTable | null {
  const [header, ...rest] = rows;
  if (!header || header.length < 2) return null;
  const data = rest.filter((cells) => cells.some((cell) => cell !== ""));
  if (data.length === 0) return null;
  const source = `Table ${n}`;
  return { source, header, rows: data.map((cells, i) => ({ ref: `${source}, row ${i + 1}`, cells })) };
}

export async function readDocx(bytes: Uint8Array): Promise<ParseResult> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let html: string;
  let text: string;
  try {
    html = (await mammoth.convertToHtml({ buffer })).value;
    text = (await mammoth.extractRawText({ buffer })).value;
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  const tables: ParsedTable[] = [];
  for (const rows of htmlTables(html)) {
    const table = toParsed(rows, tables.length + 1);
    if (table) tables.push(table);
  }
  if (tables.length === 0 && text.trim() === "") return { ok: false, reason: "no_text" };
  if (tables.reduce((sum, table) => sum + table.rows.length, 0) > MAX_IMPORT_ROWS) return { ok: false, reason: "too_many_rows" };
  return { ok: true, parsed: { format: "table", tables, text } };
}
