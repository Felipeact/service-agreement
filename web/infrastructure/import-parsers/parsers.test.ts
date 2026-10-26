import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, test } from "vitest";
import type { ParseResult, ParsedImport, ParsedTable } from "@/application/ports";
import { importParser } from "./index";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type SheetSpec = { name: string; rows: unknown[][]; hidden?: boolean; cells?: Record<string, XLSX.CellObject> };

/** An .xlsx written by SheetJS itself; `cells` overrides single cells (a date with its number format). */
function xlsx(...sheets: SheetSpec[]): Uint8Array {
  const book = XLSX.utils.book_new();
  for (const spec of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(spec.rows);
    Object.assign(sheet, spec.cells ?? {});
    XLSX.utils.book_append_sheet(book, sheet, spec.name);
  }
  book.Workbook = { Sheets: sheets.map((spec) => ({ Hidden: spec.hidden ? 1 : 0 })) };
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
}

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(import.meta.dirname, "fixtures", name)));
const bytes = (text: string) => new TextEncoder().encode(text);
const dataRows = (n: number, from = 1) => Array.from({ length: n }, (_, i) => [`RTU-${from + i}`, "Rooftop unit", "Carrier 48TC", "Roof"]);
const HEADER = ["Unit", "Type", "Model", "Location"];

function parsed(result: ParseResult): Extract<ParsedImport, { format: "table" }> {
  if (!result.ok) throw new Error(`expected a read, got ${result.reason}`);
  if (result.parsed.format !== "table") throw new Error("expected tables");
  return result.parsed;
}
const sources = (result: ParseResult) => (result.ok && result.parsed.format === "table" ? result.parsed.tables.map((t) => t.source) : []);
const readXlsx = (data: Uint8Array) => importParser.parse(XLSX_TYPE, data);
const readCsv = (data: Uint8Array) => importParser.parse("text/csv", data);
const readDocx = (data: Uint8Array) => importParser.parse(DOCX_TYPE, data);

/** C453's workbook: a title in row 1, row 2 empty, the header in row 3, 48 data rows in rows 4-51. */
const UNITS = () => xlsx({ name: "Units", rows: [["Harbourview Towers equipment list"], [], HEADER, ...dataRows(48)] });

describe("spreadsheets", () => {
  test("C453: a title row above the header, 48 data rows: one table with the header and 48 rows", async () => {
    const result = parsed(await readXlsx(UNITS()));
    expect(result.tables).toHaveLength(1);
    const [table] = result.tables;
    expect(table.source).toBe("Units");
    expect(table.header).toEqual(HEADER);
    expect(table.rows).toHaveLength(48);
  });

  test("C454: two visible sheets give one table each, in workbook order", async () => {
    const result = parsed(await readXlsx(xlsx({ name: "North", rows: [HEADER, ...dataRows(3)] }, { name: "South", rows: [HEADER, ...dataRows(4)] })));
    expect(result.tables.map((t) => t.source)).toEqual(["North", "South"]);
    expect(result.tables.map((t) => t.rows.length)).toEqual([3, 4]);
  });

  const blank = (n: number) => Array.from({ length: n }, () => []);
  const NUMBERED = [["RTU-1", 2019, "Carrier"], ["RTU-2", 2020, "Trane"]];
  const CONTROL: SheetSpec ={ name: "Control", rows: [HEADER, ...dataRows(1)] };
  test.each<[string, SheetSpec, boolean]>([
    ["a hidden sheet holding a valid table is skipped", { name: "Case", rows: [HEADER, ...dataRows(2)], hidden: true }, false],
    ["a header in row 20 is found", { name: "Case", rows: [...blank(19), HEADER, ...dataRows(2)] }, true],
    ["a header in row 21 is not found", { name: "Case", rows: [...blank(20), HEADER, ...dataRows(2)] }, false],
    ["a row with 1 non-empty text cell is not a header", { name: "Case", rows: [["Unit"], ["RTU-1"], ["RTU-2"]] }, false],
    // Data rows below carry a number each, so no later row qualifies as a header in its place.
    ["a row including the number 12 is not a header", { name: "Case", rows: [["Unit", 12, "Model"], ...NUMBERED] }, false],
    [
      "a row containing a date cell is not a header",
      { name: "Case", rows: [["Unit", "x", "Model"], ...NUMBERED], cells: { B1: { t: "n", v: 43586, z: "yyyy-mm-dd" } } },
      false,
    ],
    ["a header with no data row below is not a header", { name: "Case", rows: [HEADER] }, false],
  ])("C455: %s", async (_name, sheet, found) => {
    const result = await readXlsx(xlsx(sheet, CONTROL));
    expect(sources(result)).toEqual(found ? ["Case", "Control"] : ["Control"]);
  });

  test.each<[string, XLSX.CellObject, string]>([
    ["a date with yyyy-mm-dd", { t: "n", v: 43586, z: "yyyy-mm-dd" }, "2019-05-01"],
    ["the text 0042", { t: "s", v: "0042" }, "0042"],
    ["the number 12", { t: "n", v: 12 }, "12"],
    ["text with surrounding spaces", { t: "s", v: "  RTU-1 " }, "RTU-1"],
  ])("C461: %s reads as displayed", async (_name, cell, text) => {
    const result = parsed(await readXlsx(xlsx({ name: "S", rows: [["Unit", "Value"], ["RTU-1", "x"]], cells: { B2: cell } })));
    expect(result.tables[0].rows[0].cells[1]).toBe(text);
  });

  test("C462: spreadsheet refs carry the sheet's own row number", async () => {
    const units = parsed(await readXlsx(UNITS())).tables[0];
    expect(units.rows[0].ref).toBe("Units!4");
    expect(units.rows.at(-1)!.ref).toBe("Units!51");

    const gap = parsed(await readXlsx(xlsx({ name: "Gap", rows: [HEADER, dataRows(1)[0], [], dataRows(1, 2)[0]] }))).tables[0];
    expect(gap.rows.map((row) => row.ref)).toEqual(["Gap!2", "Gap!4"]);
  });
});

describe("CSV", () => {
  test.each([",", ";", "\t"])("C456: delimiter %j gives the same header and cells", async (sep) => {
    const text = ["Unit,Location", "RTU-1,Roof", "EF-2,Level 2", "B-3,Basement"].map((line) => line.replace(",", sep)).join("\n");
    const [table] = parsed(await readCsv(bytes(text))).tables;
    expect(table.source).toBe("CSV");
    expect(table.header).toEqual(["Unit", "Location"]);
    expect(table.rows.map((row) => row.cells)).toEqual([
      ["RTU-1", "Roof"],
      ["EF-2", "Level 2"],
      ["B-3", "Basement"],
    ]);
  });

  test("C457: Windows-1252 bytes read as Montréal", async () => {
    const data = new Uint8Array([0x55, 0x6e, 0x69, 0x74, 0x2c, 0x43, 0x69, 0x74, 0x79, 0x0a, 0x31, 0x2c, 0x4d, 0x6f, 0x6e, 0x74, 0x72, 0xe9, 0x61, 0x6c]);
    expect(parsed(await readCsv(data)).tables[0].rows[0].cells).toEqual(["1", "Montréal"]);
  });

  test("C457: UTF-8 reads as Montréal, and a BOM is dropped from the first header cell", async () => {
    expect(parsed(await readCsv(bytes("Unit,City\n1,Montréal"))).tables[0].rows[0].cells).toEqual(["1", "Montréal"]);
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("Unit,City\n1,Laval")]);
    expect(parsed(await readCsv(withBom)).tables[0].header[0]).toBe("Unit");
  });
});

describe("Word", () => {
  test("C458: two counted tables of 10 and 5 rows, the 1-column table skipped, the paragraph in text", async () => {
    const result = parsed(await readDocx(fixture("two-tables.docx")));
    expect(result.tables.map((t: ParsedTable) => t.source)).toEqual(["Table 1", "Table 2"]);
    expect(result.tables.map((t) => t.rows.length)).toEqual([10, 5]);
    expect(result.tables[1].header).toEqual(HEADER);
    expect(result.text).toContain("Mechanical room access via the north stairwell");
  });

  test("C459: text with no table is read with no tables", async () => {
    const result = parsed(await readDocx(fixture("text-only.docx")));
    expect(result.tables).toEqual([]);
    expect(result.text).toContain("Boiler room has two Lochinvar boilers");
    expect(result.text).toContain("Rooftop has four RTUs");
  });

  test("C462: Word refs name the table and the data row", async () => {
    const second = parsed(await readDocx(fixture("two-tables.docx"))).tables[1];
    expect(second.rows[0].ref).toBe("Table 2, row 1");
    expect(second.rows.at(-1)!.ref).toBe("Table 2, row 5");
  });

  test("C470: a document of whitespace only is no_text", async () => {
    expect(await readDocx(fixture("blank.docx"))).toEqual({ ok: false, reason: "no_text" });
  });
});

describe("PDF", () => {
  test.each<[string, Uint8Array]>([
    ["%PDF-1.7 at offset 0", bytes("%PDF-1.7\n1 0 obj\n%%EOF")],
    ["%PDF-1.4 after 1,000 junk bytes", new Uint8Array([...new Uint8Array(1000).fill(0x20), ...bytes("%PDF-1.4\n%%EOF")])],
  ])("C460: %s is passed on whole", async (_name, data) => {
    const result = await importParser.parse("application/pdf", data);
    expect(result).toEqual({ ok: true, parsed: { format: "pdf", bytes: data } });
    if (result.ok && result.parsed.format === "pdf") expect(Array.from(result.parsed.bytes)).toEqual(Array.from(data));
  });
});

describe("files that cannot be read", () => {
  const CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  test.each([XLSX_TYPE, DOCX_TYPE] as const)("C467: %s starting with the OLE signature is password_protected", async (type) => {
    expect(await importParser.parse(type, new Uint8Array([...CFB, 1, 2, 3, 4]))).toEqual({ ok: false, reason: "password_protected" });
  });

  const ZIP_JUNK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2]);
  test.each<[string, Parameters<typeof importParser.parse>[0], Uint8Array]>([
    [".xlsx zip signature then junk", XLSX_TYPE, ZIP_JUNK],
    [".docx zip signature then junk", DOCX_TYPE, ZIP_JUNK],
    [".xlsx that is plain text", XLSX_TYPE, bytes("Unit,Type\nRTU-1,Rooftop unit")],
    [".pdf whose %PDF- starts at offset 1,024", "application/pdf", new Uint8Array([...new Uint8Array(1024).fill(0x20), ...bytes("%PDF-1.4")])],
    [".csv containing a NUL byte", "text/csv", new Uint8Array([...bytes("Unit,Type\nRTU-1,"), 0, ...bytes("x")])],
  ])("C468: %s is corrupt", async (_name, type, data) => {
    expect(await importParser.parse(type, data)).toEqual({ ok: false, reason: "corrupt" });
  });

  test.each<[string, Parameters<typeof importParser.parse>[0], Uint8Array]>([
    [".xlsx of numbers only", XLSX_TYPE, xlsx({ name: "N", rows: [[1, 2], [3, 4], [5, 6]] })],
    [".csv with one column", "text/csv", bytes("Unit\nRTU-1\nRTU-2")],
    [".csv with a header and no data row", "text/csv", bytes("Unit,Type\n")],
  ])("C469: %s is no_table", async (_name, type, data) => {
    expect(await importParser.parse(type, data)).toEqual({ ok: false, reason: "no_table" });
  });

  const csvRows = (n: number) => bytes(["Unit,Type", ...Array.from({ length: n }, (_, i) => `RTU-${i},Rooftop unit`)].join("\n"));
  test("C471: 2,000 data rows are read", async () => {
    expect(parsed(await readCsv(csvRows(2000))).tables[0].rows).toHaveLength(2000);
  });
  test("C471: 2,001 data rows are too_many_rows", async () => {
    expect(await readCsv(csvRows(2001))).toEqual({ ok: false, reason: "too_many_rows" });
  });
  test("C471: 1,000 and 1,001 rows across two sheets are too_many_rows", async () => {
    const data = xlsx({ name: "A", rows: [HEADER, ...dataRows(1000)] }, { name: "B", rows: [HEADER, ...dataRows(1001)] });
    expect(await readXlsx(data)).toEqual({ ok: false, reason: "too_many_rows" });
  });
  test("C471: a sheet of 100,000 data rows is too_many_rows", async () => {
    expect(await readXlsx(xlsx({ name: "Big", rows: [HEADER, ...dataRows(100_000)] }))).toEqual({ ok: false, reason: "too_many_rows" });
  }, 30_000);
});
