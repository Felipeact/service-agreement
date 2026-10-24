import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { AssetView, SiteView } from "@/application/ports";
import { filterAssets, groupAssets } from "./assets";
import { SiteRegisterView } from "./site-register-view";

let counter = 0;
const asset = (patch: Partial<AssetView> = {}): AssetView => ({
  id: `a${++counter}`,
  typeCode: "BOILER",
  typeName: "Boiler",
  unitNo: "B-1",
  typeModel: "Condensing boiler, 1,000 MBH",
  location: "Mechanical room P1",
  source: "manual",
  ...patch,
});

const site = (assets: AssetView[]): SiteView => ({
  id: "s1",
  name: "Harbourview Towers",
  address: "2150 Harbour Lane, North Vancouver, BC",
  customerId: "cust-1",
  customerName: "Harbourview Towers Strata",
  contactName: "Dana Whitfield",
  assets,
});

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const view = (assets: AssetView[], initialQuery?: string) => html(createElement(SiteRegisterView, { site: site(assets), initialQuery }));

describe("SiteRegisterView", () => {
  test("C135: header shows the title, address, customer link, contact and the asset badge", () => {
    const out = view(Array.from({ length: 5 }, () => asset()));
    expect(out).toContain("Harbourview Towers");
    expect(out).toContain("2150 Harbour Lane, North Vancouver, BC");
    expect(out).toMatch(/<a[^>]*href="\/customers\/cust-1"[^>]*>Harbourview Towers Strata</);
    expect(out).toContain("Dana Whitfield");
    expect(out).toContain(">5 assets<");
    expect(view([asset()])).toContain(">1 asset<");
  });

  test("C138: a row shows unit, model, location and source; gaps are dashes", () => {
    const out = view([asset()]);
    for (const text of ["B-1", "Condensing boiler, 1,000 MBH", "Mechanical room P1", "Manual"]) expect(out).toContain(text);
    expect(view([asset({ source: "import" })])).toContain("Imported");
    expect(view([asset({ typeModel: null })])).toMatch(/<span[^>]*>-<\/span>/);
  });

  test("C140: a search with no match shows the message and Clear search", () => {
    const out = view([asset()], "zzz");
    expect(out).toContain('No equipment matches "zzz"');
    expect(out).toMatch(/<button[^>]*>Clear search</);
  });

  test("C141: a site with no assets shows the empty panel", () => {
    const out = view([]);
    expect(out).toContain("No equipment recorded yet");
    expect(out).toContain("Equipment appears here once it is added or imported.");
  });
});

describe("groupAssets", () => {
  test("C136: groups are ordered by type name and headed code - name with a count", () => {
    const groups = groupAssets([
      asset({ typeCode: "RTU", typeName: "Rooftop unit" }),
      asset({ typeCode: "BOILER", typeName: "Boiler" }),
      asset({ typeCode: "BOILER", typeName: "Boiler" }),
      asset({ typeCode: "EXPANSION_TANK", typeName: "Expansion tank" }),
    ]);
    expect(groups.map((group) => [group.heading, group.count])).toEqual([
      ["BOILER - Boiler", 2],
      ["EXPANSION_TANK - Expansion tank", 1],
      ["RTU - Rooftop unit", 1],
    ]);
  });

  test("C137: rows order numerically by unit, and rows without a unit go last", () => {
    const [group] = groupAssets([
      asset({ unitNo: "B-10" }),
      asset({ unitNo: null, id: "n1" }),
      asset({ unitNo: "B-2" }),
      asset({ unitNo: null, id: "n2" }),
      asset({ unitNo: "B-1" }),
    ]);
    expect(group.rows.map((row) => row.unitNo)).toEqual(["B-1", "B-2", "B-10", null, null]);
  });
});

describe("filterAssets", () => {
  const boiler = asset({ unitNo: "B-2", typeModel: "Condensing boiler", location: "Mechanical room P1" });
  const tank = asset({ typeCode: "EXPANSION_TANK", typeName: "Expansion tank", unitNo: "ET-1", typeModel: "Bladder", location: "Roof" });
  const all = [boiler, tank];

  test("C139: matches unit, model, location and type name, ignoring case", () => {
    expect(filterAssets(all, "b-2")).toEqual([boiler]);
    expect(filterAssets(all, "condensing")).toEqual([boiler]);
    expect(filterAssets(all, "MECHANICAL room")).toEqual([boiler]);
    expect(filterAssets(all, "expansion")).toEqual([tank]);
    expect(filterAssets(all, "zzz")).toEqual([]);
  });

  test("C139: a group left with no rows disappears", () => {
    expect(groupAssets(filterAssets(all, "roof")).map((group) => group.code)).toEqual(["EXPANSION_TANK"]);
  });
});
