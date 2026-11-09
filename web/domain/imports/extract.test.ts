import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { CHUNK_ROWS, chunksOf, matchAssetType, type AssetTypeRef, type ChunkSource } from ".";
import * as imports from ".";

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

const type = (code: string, name: string, synonyms: string[] = []): AssetTypeRef => ({ id: `id-${code}`, code, name, synonyms });
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

  const rtuSpelled = type("RTU", "Packaged Equipment", ["rooftop unit"]);
  const muaSpelled = type("MUA", "Fresh Air", ["mau"]);
  test.each<[string, string, AssetTypeRef[], string | null]>([
    ["Rooftop unit", "Rooftop unit", [rtuSpelled, muaSpelled], "id-RTU"],
    ["MAU", "MAU", [rtuSpelled, muaSpelled], "id-MUA"],
    ["mau in lower case", "mau", [rtuSpelled, muaSpelled], "id-MUA"],
    ["MAU when a type is named MAU", "MAU", [rtuSpelled, muaSpelled, type("MAU2", "MAU")], "id-MAU2"],
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

describe("spellings stored on the org's types (synonyms-as-data)", () => {
  const CIRCULATOR = type("CIRC", "Circulator", ["pump"]);

  test.each<[string, string, AssetTypeRef[], string | null]>([
    ["exact", "Rooftop unit", [type("RTU", "Packaged", ["rooftop unit"]), HWT], "id-RTU"],
    ["case and a double space", "ROOF-TOP  UNIT", [type("RTU", "Packaged", ["roof top unit"]), HWT], "id-RTU"],
    ["a trailing full stop", "Rooftop Unit.", [type("RTU", "Packaged", ["rooftop unit"])], "id-RTU"],
    ["a hyphen against a space", "Make-up air", [type("MUA", "Fresh Air", ["make up air"]), RTU], "id-MUA"],
    ["the last of several spellings", "Packaged Rooftop Unit", [type("RTU", "Packaged", ["rooftop unit", "rooftop", "roof top unit", "packaged rooftop unit"]), HWT], "id-RTU"],
    ["a middle spelling of the second of two types", "gas unit heater", [type("RTU", "Packaged", ["rooftop unit"]), type("UHG", "Heater", ["unit heater", "gas unit heater", "gas fired unit heater"])], "id-UHG"],
    ["a spelling written with punctuation", "O'Brien Unit", [type("OB", "Obrien", ["o'brien unit"]), HWT], "id-OB"],
    ["a spelling written with capitals and a hyphen", "walk in cooler", [type("WIC", "Cooler", ["Walk-In Cooler"]), HWT], "id-WIC"],
  ])("C2101: wording %s is typed by the one type that holds the spelling", (_name, raw, types, expected) => {
    expect(matchAssetType(raw, types)).toBe(expected);
  });

  test("C2102: a spelling that is not a type's first is found for the ambiguity too", () => {
    expect(matchAssetType("pump", [type("CIRC", "Circulator", ["circulator", "pump"]), type("SUMP", "Sump", ["sump", "pump"])])).toBeNull();
  });

  test("C2102: a spelling held by two distinct types gives no type, and one type listing it twice still does", () => {
    expect(matchAssetType("pump", [type("CIRC", "Circulator", ["pump"]), type("SUMP", "Sump", ["pump"])])).toBeNull();
    expect(matchAssetType("pump", [type("CIRC", "Circulator", ["pump", "pump"]), type("SUMP", "Sump", ["sump"])])).toBe("id-CIRC");
  });

  test("C2103: a code or a name wins over a spelling", () => {
    expect(matchAssetType("Pump", [type("CP", "Pump"), CIRCULATOR])).toBe("id-CP");
    expect(matchAssetType("RTU", [type("RTU", "Roof thing"), type("OTHER", "Other", ["rtu"])])).toBe("id-RTU");
  });

  test("C2104: a type whose code equals a pack code brings no spellings with it", () => {
    const types = [type("RTU", "Roof thing", []), type("MUA", "Make-up air", ["mau"])];
    expect(matchAssetType("rooftop unit", types)).toBeNull();
    expect(matchAssetType("mau", types)).toBe("id-MUA");
  });

  test("C2108: SYNONYMS is exported nowhere and appears in no source file under web/ but this scan", () => {
    expect("SYNONYMS" in imports).toBe(false);
    const root = path.join(__dirname, "..", "..");
    const word = ["SYN", "ONYMS"].join("");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && readFileSync(full, "utf8").includes(word)) found.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(found.filter((file) => path.basename(file) !== "extract.test.ts")).toEqual([]);
  });
});
