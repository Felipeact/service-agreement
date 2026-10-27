import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { CHUNK_ROWS, chunksOf, matchAssetType, SYNONYMS, type AssetTypeRef, type ChunkSource } from ".";

const table = (source: string, rows: number, first = 2) => ({
  source,
  header: ["Unit", "Type"],
  rows: Array.from({ length: rows }, (_, i) => ({ ref: `${source}!${first + i}`, cells: [`U${i}`, "RTU"] })),
});
const tables = (...sizes: number[]): ChunkSource => ({ format: "table", tables: sizes.map((n, i) => table(`T${i + 1}`, n)), text: "notes" });

const rowsOf = (chunk: ReturnType<typeof chunksOf>[number]) => (chunk.kind === "rows" ? chunk.rows.length : -1);

describe("chunksOf", () => {
  test.each<[string, number[], number[]]>([
    ["one table of 340", [340], [100, 100, 100, 40]],
    ["one table of 100", [100], [100]],
    ["one table of 101", [101], [100, 1]],
    ["tables of 150 and 30", [150, 30], [100, 50, 30]],
    ["one table of 1", [1], [1]],
  ])("C503: %s is cut into %j", (_name, sizes, expected) => {
    expect(CHUNK_ROWS).toBe(100);
    expect(chunksOf(tables(...sizes)).map(rowsOf)).toEqual(expected);
  });

  test("C503: chunk n of a 340-row table starts at row 100 * n + 1 and rows keep their ref", () => {
    const chunks = chunksOf(tables(340));
    chunks.forEach((chunk, n) => {
      expect(chunk.kind).toBe("rows");
      if (chunk.kind !== "rows") return;
      expect(chunk.table).toBe("T1");
      expect(chunk.rows[0].ref).toBe(`T1!${100 * n + 2}`);
      expect(chunk.rows[0].cells[0]).toBe(`U${100 * n}`);
    });
  });

  test("C508: a file with no table is one text chunk holding the document text", () => {
    const source: ChunkSource = { format: "table", tables: [], text: "Unit 1: RTU on roof" };
    expect(chunksOf(source)).toEqual([{ kind: "text", text: "Unit 1: RTU on roof" }]);
  });

  test("C509: a pdf is one pdf chunk with the same bytes", () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const chunks = chunksOf({ format: "pdf", bytes });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ kind: "pdf", bytes });
  });

  test("C509: the document text of a file that also has tables is not in any chunk", () => {
    const chunks = chunksOf({ format: "table", tables: [table("T1", 3)], text: "notes" });
    expect(JSON.stringify(chunks)).not.toContain("notes");
    expect(chunks.map((c) => c.kind)).toEqual(["rows"]);
  });
});

const type = (code: string, name: string): AssetTypeRef => ({ id: `id-${code}`, code, name });
const RTU = type("RTU", "Rooftop Unit");
const HWT = type("HWT_HIGH_EFFICIENCY", "High Efficiency Water Heater");
const MUA = type("MUA", "Make-Up Air Unit");

describe("matchAssetType", () => {
  test.each<[string, string, string | null]>([
    ["a code", "RTU", "id-RTU"],
    ["a code in odd case and spacing", "  rtu ", "id-RTU"],
    ["a name with a hyphen", "Rooftop-Unit", "id-RTU"],
    ["a code with underscores written with hyphens", "HWT-High-Efficiency", "id-HWT_HIGH_EFFICIENCY"],
    ["a name without punctuation", "make up air unit", "id-MUA"],
    ["wording that is only close", "Rooftop Unit #2", null],
  ])("C515: %s matches", (_name, raw, expected) => {
    expect(matchAssetType(raw, [RTU, HWT, MUA])).toBe(expected);
  });

  test.each<[string, string, AssetTypeRef[], string | null]>([
    ["Rooftop unit", "Rooftop unit", [type("RTU", "Packaged Equipment"), type("MUA", "Fresh Air")], "id-RTU"],
    ["MAU", "MAU", [type("RTU", "Packaged Equipment"), type("MUA", "Fresh Air")], "id-MUA"],
    ["mau in lower case", "mau", [type("RTU", "Packaged Equipment"), type("MUA", "Fresh Air")], "id-MUA"],
    ["MAU when a type is named MAU", "MAU", [type("RTU", "Packaged Equipment"), type("MUA", "Fresh Air"), type("MAU2", "MAU")], "id-MAU2"],
  ])("C516: synonym case %s", (_name, raw, types, expected) => {
    expect(matchAssetType(raw, types)).toBe(expected);
  });

  test.each<[string, string | null, AssetTypeRef[]]>([
    ["null", null, [RTU]],
    ["empty", "", [RTU]],
    ["blank", "   ", [RTU]],
    ["no code, name or synonym", "Widget", [RTU, MUA]],
    ["two types with equal names", "Exhaust fan", [type("EF1", "Exhaust Fan"), type("EF2", "exhaust-fan")]],
    ["a code of one type and the name of another", "pump", [type("PUMP", "Circulator"), type("CP", "Pump")]],
  ])("C517: %s gives no type", (_name, raw, types) => {
    expect(matchAssetType(raw, types)).toBeNull();
  });

  test("C518: only the types it is given are matched", () => {
    expect(matchAssetType("MAU", [type("RTU", "Rooftop Unit")])).toBeNull();
    expect(matchAssetType("Rooftop unit", [type("RTU", "Rooftop Unit")])).toBe("id-RTU");
    expect(matchAssetType("Rooftop unit", [type("MUA", "Make-Up Air Unit")])).toBeNull();
  });
});

describe("SYNONYMS", () => {
  test("C520: every key is a code of the standard catalog and the roadmap's examples are present", () => {
    const sql = readFileSync(path.join(__dirname, "../../../supabase/migrations/20261019191509_catalog_template.sql"), "utf8");
    for (const code of Object.keys(SYNONYMS)) expect(sql, code).toContain(`('${code}',`);
    expect(SYNONYMS.RTU).toContain("rooftop unit");
    expect(SYNONYMS.MUA).toContain("mau");
  });
});
