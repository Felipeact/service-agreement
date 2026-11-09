import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { matchAssetType, type AssetTypeRef } from ".";

// The spelling lists are read from the migrations that hold them, so the claim is about the data that ships.
const supabase = path.join(__dirname, "..", "..", "..", "supabase");
const migration = (file: string) => readFileSync(path.join(supabase, "migrations", file), "utf8");
const quoted = (list: string) => [...list.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));

type PackType = { pack: string; code: string; name: string; synonyms: string[] };

function hvacTypes(): PackType[] {
  const names = [...migration("20261019191509_catalog_template.sql").split("insert into private.catalog_asset_type_tasks")[0]
    .matchAll(/^\s*\('([A-Z0-9_]+)', '([^']*)'\)[,;]\r?$/gm)].map((m) => ({ code: m[1], name: m[2] }));
  const spellings = new Map(
    [...migration("20261109154806_synonyms_as_data.sql").matchAll(/^\s*\('([A-Z0-9_]+)', array\[(.*)\]\),?\r?$/gm)].map((m) => [m[1], quoted(m[2])]),
  );
  return names.map((n) => ({ pack: "hvac", ...n, synonyms: spellings.get(n.code) ?? [] }));
}

function newPackTypes(): PackType[] {
  return [...migration("20261109163948_starter_packs.sql").matchAll(/^\s*\('(plumbing|electrical)', '([A-Z0-9_]+)', '([^']*)', '\{[0-9,]+\}', array\[(.*)\]\)[,;]\r?$/gm)]
    .map((m) => ({ pack: m[1], code: m[2], name: m[3], synonyms: quoted(m[4]) }));
}

/** One org's list: a code appears once, and the pack seeded first keeps it (AD-154). */
function orgList(order: string[], all: PackType[]): (AssetTypeRef & { pack: string })[] {
  const byCode = new Map<string, PackType>();
  for (const pack of order) for (const t of all.filter((x) => x.pack === pack)) if (!byCode.has(t.code)) byCode.set(t.code, t);
  return [...byCode.values()].map((t) => ({ id: `${t.pack}:${t.code}`, ...t }));
}

describe("starter packs: the real matcher over the shipped spellings", () => {
  const hvac = hvacTypes();
  const added = newPackTypes();
  const all = [...hvac, ...added];

  test("C2222: the sources parse to 40 hvac types (27 with spellings), 20 plumbing and 20 electrical", () => {
    expect(hvac).toHaveLength(40);
    expect(hvac.filter((t) => t.synonyms.length > 0)).toHaveLength(27);
    expect(added.filter((t) => t.pack === "plumbing")).toHaveLength(20);
    expect(added.filter((t) => t.pack === "electrical")).toHaveLength(20);
  });

  for (const order of [["hvac", "plumbing", "electrical"], ["plumbing", "electrical", "hvac"], ["electrical", "hvac", "plumbing"]]) {
    test(`C2222: every spelling of an org seeded ${order.join(", ")} types to its own type, however it is cased or punctuated`, () => {
      const org = orgList(order, all);
      expect(org).toHaveLength(77);
      let spellings = 0;
      for (const type of org) {
        for (const spelling of type.synonyms) {
          spellings++;
          expect(matchAssetType(spelling, org), `${type.pack} ${type.code}: ${spelling}`).toBe(type.id);
          expect(matchAssetType(spelling.toUpperCase().replace(/ /g, "-"), org), `${type.pack} ${type.code}: ${spelling} (upper, hyphens)`).toBe(type.id);
        }
      }
      expect(spellings).toBeGreaterThan(100);
    });
  }

  test("C2222: a spelling written by a pack that lost a shared code is left untyped, not given to another type", () => {
    // Seeded hvac first, the three shared types hold no spelling, so a plumbing spelling of one of them matches nothing.
    const org = orgList(["hvac", "plumbing", "electrical"], all);
    expect(matchAssetType("rpz", org)).toBeNull();
    expect(matchAssetType("prv", org)).toBeNull();
    expect(matchAssetType("thermal expansion tank", org)).toBeNull();
  });
});

describe("starter packs: the saved review query", () => {
  const file = readFileSync(path.join(supabase, "packs", "sheet.sql"), "utf8");
  const statements = file.split(/\r?\n/).filter((line) => !line.trim().startsWith("--")).join("\n");

  test("C2226: supabase/packs/sheet.sql runs the sheet function for plumbing and for electrical and names no other table", () => {
    expect(statements).toContain("private.pack_review_sheet('plumbing')");
    expect(statements).toContain("private.pack_review_sheet('electrical')");
    const sources = [...statements.matchAll(/\bfrom\s+([a-z_.]+)/gi)].map((m) => m[1]);
    expect(sources).toEqual(["private.pack_review_sheet", "private.pack_review_sheet"]);
  });
});
