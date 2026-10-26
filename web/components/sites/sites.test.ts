import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { AssetView, MemberRole, SiteView } from "@/application/ports";
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
  siteContactId: "ct-1",
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

  test("C136: the rendered view shows each group heading with its count", () => {
    const out = view([asset(), asset(), asset({ typeCode: "RTU", typeName: "Rooftop unit" })]);
    expect(out).toMatch(/BOILER - Boiler<span[^>]*>2</);
    expect(out).toMatch(/RTU - Rooftop unit<span[^>]*>1</);
    expect(out.indexOf("BOILER - Boiler")).toBeLessThan(out.indexOf("RTU - Rooftop unit"));
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

const siteAs = (role: MemberRole, assets: AssetView[]) => html(createElement(SiteRegisterView, { site: site(assets), role }));

describe("record write controls on the site register", () => {
  test("C316: a writer sees Edit site", () => {
    expect(siteAs("estimator", [])).toMatch(/<a[^>]*href="\/sites\/s1\/edit"[^>]*>Edit site<\/a>/);
  });

  test("C322: a writer sees Add asset in the header, and Edit on each asset row", () => {
    const out = siteAs("estimator", [asset({ id: "a-1" }), asset({ id: "a-2" })]);
    expect(out).toMatch(/<a[^>]*href="\/sites\/s1\/assets\/new"[^>]*>Add asset<\/a>/);
    expect(out).toMatch(/<a[^>]*href="\/assets\/a-1\/edit"[^>]*>Edit<\/a>/);
    expect(out).toMatch(/<a[^>]*href="\/assets\/a-2\/edit"[^>]*>Edit<\/a>/);
  });

  test("C322: an empty register offers Add asset too", () => {
    const out = siteAs("estimator", []);
    expect(out.match(/<a[^>]*href="\/sites\/s1\/assets\/new"[^>]*>Add asset<\/a>/g)).toHaveLength(2);
    expect(out).toMatch(/No equipment recorded yet[\s\S]*<a[^>]*href="\/sites\/s1\/assets\/new"/);
  });

  test.each([
    ["register with assets", [asset()]],
    ["empty register", []],
  ] as [string, AssetView[]][])("C329: a viewer's %s has no write controls", (_name, assets) => {
    const out = siteAs("viewer", assets);
    expect(out).not.toMatch(/href="[^"]*\/(new|edit)"/);
    for (const text of ["New customer", "Add contact", "Add site", "Add asset", ">Edit<", "Edit site", "Delete"]) expect(out).not.toContain(text);
  });

  test("C348: a writer still sees every asset row", () => {
    const out = siteAs("estimator", [asset({ unitNo: "B-7", typeModel: "Condensing boiler", location: "Roof" })]);
    expect(out).toContain("B-7");
    expect(out).toContain("Condensing boiler");
    expect(out).toContain("Roof");
    expect(out).toContain("Manual");
  });
});

describe("import entry point on the site register", () => {
  test("C401: a writer sees Import equipment list in the header", () => {
    const header = siteAs("estimator", [asset()]).match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toMatch(/<a[^>]*href="\/sites\/s1\/import"[^>]*>Import equipment list<\/a>/);
  });

  test("C424: a viewer has no link to the import page", () => {
    const out = siteAs("viewer", [asset()]);
    expect(out).not.toContain('href="/sites/s1/import"');
    expect(out).not.toContain("Import equipment list");
  });

  test("C444: a writer still sees every asset row and Add asset", () => {
    const out = siteAs("estimator", [asset({ unitNo: "B-7", typeModel: "Condensing boiler", location: "Roof" })]);
    for (const text of ["B-7", "Condensing boiler", "Roof", "Manual"]) expect(out, text).toContain(text);
    expect(out).toMatch(/<a[^>]*href="\/sites\/s1\/assets\/new"[^>]*>Add asset<\/a>/);
  });
});
