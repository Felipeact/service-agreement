import { describe, expect, test } from "vitest";
import { DRAFT_MARK, type AgreementDocument } from "@/domain/agreement";
import { reactPdfDocumentRenderer } from "./index";
import { pdfColours, pdfPages, winAnsi } from "./pdf-text.testing";

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const base: AgreementDocument = {
  tenant: { name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100", accent: "#1f6f8b" },
  number: "AG-1052",
  versionNo: 1,
  customerName: "Fernwood Dental",
  siteName: "Fernwood Dental, Main",
  mark: null,
  lines: [
    { description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 },
    { description: "Filter change", visitsPerYear: 2, costPerVisitCents: 94500, annualCents: 189000 },
  ],
  totalCents: 387000,
  schedule: [],
  scope: { kind: "listed", recordedOn: null, types: [] },
  terms: [
    { label: "Repair discount", value: "10%" },
    { label: "CPI cap", value: "5%" },
    { label: "Cancellation notice", value: "30 days" },
    { label: "Payment terms", value: "30 days" },
    { label: "Governing province", value: "BC" },
    { label: "Tax note", value: "GST extra" },
  ],
};

const asset = (unitNo: string | null, typeModel: string | null = null, location: string | null = null) => ({ unitNo, typeModel, location });
const type = (name: string, tasks: string[], assets: ReturnType<typeof asset>[]) => ({ code: name.toUpperCase(), name, tasks, assets });

async function render(over: Partial<AgreementDocument>) {
  return pdfPages(await reactPdfDocumentRenderer.renderAgreement({ ...base, ...over }));
}
const text = (pages: string[]) => pages.join("\n");
/** The text with the hyphen a wrapped long word gets, and the line breaks, taken out. */
const unwrapped = (pages: string[]) => text(pages).replace(/-\n/g, "").replace(/\n/g, "");
const indexOfIn = (haystack: string, ...needles: string[]) => needles.map((needle) => haystack.indexOf(needle));
const inOrder = (positions: number[]) => positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]));

describe("the agreement PDF, rendered", () => {
  test("C858: page 1 starts with the tenant's name, then its address, then its phone", async () => {
    const [first] = await render({});
    expect(inOrder(indexOfIn(first, "Kettle Ridge Mechanical Ltd.", "100 Sample Street, Burnaby, BC", "604-555-0100"))).toBe(true);
    expect(first.startsWith("Kettle Ridge Mechanical Ltd.")).toBe(true);
  });

  test("C858: a tenant with no address or phone prints no empty or null line", async () => {
    const [first] = await render({ tenant: { ...base.tenant, address: null, phone: null } });
    expect(first).not.toMatch(/null|undefined/);
    expect(first.split("\n")[1]).toBe("Preventive maintenance service agreement");
  });

  test("C859: page 1 carries the number, the version, the customer and the site", async () => {
    const [first] = await render({ versionNo: 3 });
    for (const expected of ["AG-1052", "Version 3", "Fernwood Dental", "Fernwood Dental, Main"]) expect(first).toContain(expected);
    expect(inOrder(indexOfIn(first, "AG-1052", "Version 3", "Fernwood Dental, Main"))).toBe(true);
  });

  test("C860: every line prints its figures in CAD, then the total and 'before tax'", async () => {
    const all = text(await render({}));
    for (const expected of ["Quarterly visit", "$450.00", "$1,800.00", "Filter change", "$945.00", "$1,890.00", "Total per year", "$3,870.00", "before tax"]) {
      expect(all).toContain(expected);
    }
    expect(inOrder(indexOfIn(all, "Filter change", "Total per year", "$3,870.00", "before tax"))).toBe(true);
  });

  test("C860: the total printed follows the input, not the lines", async () => {
    const all = text(await render({ totalCents: 123456 }));
    expect(all).toContain("$1,234.56");
    expect(all).not.toContain("$3,870.00");
  });

  test("C861: with no lines it says so, and prints no total and no column header", async () => {
    const all = text(await render({ lines: [], totalCents: 0 }));
    expect(all).toContain("No services priced yet");
    expect(all).not.toContain("Total per year");
    expect(all).not.toContain("Visits per year");
  });

  test("C862: Service included lists the types in the order given, with counts and checklists", async () => {
    const types = [
      type("AHU", ["Replace filters", "Check belts"], [asset("A-1"), asset("A-2")]),
      type("Boiler", [], [asset("B-1")]),
      type("Unit heater", ["Inspect burner"], [asset("U-1")]),
    ];
    const all = text(await render({ scope: { kind: "listed", recordedOn: null, types } }));
    const section = all.slice(all.indexOf("Service included"), all.indexOf("Equipment"));
    expect(inOrder(indexOfIn(section, "AHU, 2 units", "- Replace filters", "- Check belts", "Boiler, 1 unit", "Unit heater, 1 unit", "- Inspect burner"))).toBe(true);
    expect(section).not.toContain("Boiler, 1 unit\n-");
  });

  test("C863: Equipment has one row per asset under its type, and a missing field is an empty cell", async () => {
    const types = [type("AHU", [], [asset("A-1", "Model 7", "Roof"), asset("A-2")]), type("Boiler", [], [asset(null, null, "Basement")])];
    const all = text(await render({ scope: { kind: "listed", recordedOn: null, types } }));
    const section = all.slice(all.lastIndexOf("Equipment"), all.indexOf("Terms"));
    expect(inOrder(indexOfIn(section, "AHU", "A-1", "Model 7", "Roof", "A-2", "Boiler", "Basement"))).toBe(true);
    expect(all).not.toMatch(/null|undefined/);
  });

  test("C864: the terms print with their values, and a term left out is absent", async () => {
    const all = text(await render({}));
    for (const expected of ["Repair discount", "10%", "CPI cap", "5%", "Cancellation notice", "Payment terms", "30 days", "Governing province", "BC", "Tax note", "GST extra"]) {
      expect(all).toContain(expected);
    }
    const without = text(await render({ terms: base.terms.filter((term) => term.label !== "Tax note") }));
    expect(without).not.toContain("Tax note");
    expect(without).toContain("Governing province");
  });

  test("C865: a long document has the footer on each of its pages and keeps a line's cells on one page", async () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({ description: `Line ${i + 1}`, visitsPerYear: 1, costPerVisitCents: 10000 + i, annualCents: 10000 + i }));
    const types = [type("AHU", Array.from({ length: 40 }, (_, i) => `Task ${i + 1}`), Array.from({ length: 150 }, (_, i) => asset(`U-${i + 1}`)))];
    const pages = await render({ lines, totalCents: 1, scope: { kind: "listed", recordedOn: null, types } });
    expect(pages.length).toBeGreaterThanOrEqual(3);
    pages.forEach((page, i) => {
      const rows = page.split("\n");
      expect(rows.slice(-2)).toEqual(["AG-1052", `Page ${i + 1} of ${pages.length}`]);
      expect(["Service included", "Equipment", "Terms", "Service and price"]).not.toContain(rows[rows.length - 3]);
    });
    lines.forEach((line, i) => {
      const home = pages.filter((page) => page.includes(`${line.description}\n`) && page.includes(`$${(line.annualCents / 100).toFixed(2)}`));
      expect(home.length, `line ${i + 1}`).toBeGreaterThanOrEqual(1);
    });
    const line30 = pages.findIndex((page) => page.includes("Line 30\n"));
    expect(pages[line30]).toContain("$100.29");
  });

  test("C866: the draft mark is on every page of a long draft and on no page of a sent version", async () => {
    const types = [type("AHU", [], Array.from({ length: 200 }, (_, i) => asset(`U-${i + 1}`)))];
    const scope = { kind: "listed" as const, recordedOn: null, types };
    const draft = await render({ mark: DRAFT_MARK, scope });
    expect(draft.length).toBeGreaterThanOrEqual(3);
    for (const page of draft) expect(page).toContain("DRAFT - not yet sent to the customer");
    for (const page of await render({ mark: null, scope })) expect(page).not.toContain("DRAFT");
  });

  test("C867: a frozen scope prints when it was recorded, and no draft mark", async () => {
    const recordedOn = new Date("2026-10-20T15:00:00Z");
    const types = [type("AHU", ["Replace filters"], [asset("A-1")])];
    const all = text(await render({ scope: { kind: "listed", recordedOn, types } }));
    expect(all).toContain(`Scope recorded ${date.format(recordedOn)}`);
    expect(all).toContain("AHU, 1 unit");
    expect(all).not.toContain("DRAFT");
    expect(text(await render({}))).not.toContain("Scope recorded");
  });

  test("C868: a scope nobody recorded says so, has neither heading, and keeps the lines and total", async () => {
    const all = text(await render({ scope: { kind: "not_recorded" } }));
    expect(all).toContain("The equipment covered by this version was not recorded");
    expect(all).not.toContain("Service included");
    expect(all).not.toContain("Equipment\n");
    expect(all).toContain("Quarterly visit");
    expect(all).toContain("$3,870.00");
  });

  test("C870: 2,000 assets in 40 types all print, and the time is recorded", async () => {
    const types = Array.from({ length: 40 }, (_, t) => type(`Type ${String(t + 1).padStart(2, "0")}`, ["Inspect"], Array.from({ length: 50 }, (_, a) => asset(`T${t + 1}-${a + 1}`))));
    const started = performance.now();
    const pages = await render({ scope: { kind: "listed", recordedOn: null, types } });
    const seconds = (performance.now() - started) / 1000;
    const found = new Set(text(pages).match(/^T\d+-\d+$/gm));
    expect(found.size).toBe(2000);
    expect(pages.length).toBeGreaterThan(20);
    process.stderr.write(`C870 measured: 2,000 assets, ${pages.length} pages, ${seconds.toFixed(1)} s\n`);
  }, 120_000);

  test.each([
    ["a service-line description", (long: string) => ({ lines: [{ ...base.lines[0], description: long }] })],
    ["an asset location", (long: string) => ({ scope: { kind: "listed" as const, recordedOn: null, types: [type("AHU", [], [asset("A-1", null, long)])] } })],
    ["the tenant's legal name", (long: string) => ({ tenant: { ...base.tenant, name: long } })],
  ])("C871: 200 characters with no space in %s are all printed", async (_where, make) => {
    const long = "Abcdefghij".repeat(20);
    expect(unwrapped(await render(make(long)))).toContain(long);
  });

  test("C871: the long word wraps onto several lines rather than running on", async () => {
    const long = "x".repeat(200);
    const lines = text(await render({ lines: [{ ...base.lines[0], description: long }] })).split("\n");
    expect(lines.filter((line) => /^x+-?$/.test(line)).length).toBeGreaterThan(3);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(60);
  });

  test("C858: the accent colour is drawn on the page, and a different accent draws a different colour", async () => {
    const draw = async (accent: string) => pdfColours(await reactPdfDocumentRenderer.renderAgreement({ ...base, tenant: { ...base.tenant, accent } }));
    const teal = await draw("#1f6f8b");
    const plum = await draw("#7a1f5c");
    expect(teal.has("#1f6f8b")).toBe(true);
    expect(teal.has("#7a1f5c")).toBe(false);
    expect(plum.has("#7a1f5c")).toBe(true);
    expect(plum.has("#1f6f8b")).toBe(false);
  });

  test("C858: the accent is both the heading text colour and the title rule's stroke", async () => {
    const bytes = await reactPdfDocumentRenderer.renderAgreement({ ...base, tenant: { ...base.tenant, accent: "#7a1f5c" } });
    expect(pdfColours(bytes, "scn").has("#7a1f5c")).toBe(true);
    expect(pdfColours(bytes, "SCN").has("#7a1f5c")).toBe(true);
    const other = await reactPdfDocumentRenderer.renderAgreement({ ...base, tenant: { ...base.tenant, accent: "#1f6f8b" } });
    expect(pdfColours(other, "SCN").has("#7a1f5c")).toBe(false);
  });

  test("C860: each line prints its own visits per year between its description and its prices", async () => {
    const lines = [
      { description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 },
      { description: "Monthly check", visitsPerYear: 12, costPerVisitCents: 10000, annualCents: 120000 },
    ];
    const rows = text(await render({ lines, totalCents: 300000 })).split("\n");
    const at = (label: string) => rows.indexOf(label);
    expect(rows.slice(at("Quarterly visit"), at("Quarterly visit") + 4)).toEqual(["Quarterly visit", "4", "$450.00", "$1,800.00"]);
    expect(rows.slice(at("Monthly check"), at("Monthly check") + 4)).toEqual(["Monthly check", "12", "$100.00", "$1,200.00"]);
  });

  test("C863: exactly one row per asset, three for three assets, in two types", async () => {
    const types = [type("AHU", [], [asset("A-1", "Model 7", "Roof"), asset("A-2", "Model 8", "Roof")]), type("Boiler", [], [asset("B-1", "Cast iron", "Basement")])];
    const all = text(await render({ scope: { kind: "listed", recordedOn: null, types } }));
    const section = all.slice(all.lastIndexOf("Equipment"), all.indexOf("Terms")).split("\n");
    expect(section.filter((row) => /^[AB]-\d$/.test(row))).toEqual(["A-1", "A-2", "B-1"]);
    expect(section.filter((row) => /^(Model 7|Model 8|Cast iron)$/.test(row))).toHaveLength(3);
  });

  test("C871: a 200-character word changes the page count by no more than the lines it adds", async () => {
    const plain = await render({});
    const long = await render({ lines: [{ ...base.lines[0], description: "Abcdefghij".repeat(20) }, base.lines[1]] });
    expect(plain).toHaveLength(1);
    expect(long).toHaveLength(plain.length);
  });

  test("C872: accents and apostrophes survive as the customer, a task and a location", async () => {
    const name = "Café Rénée’s";
    const types = [type("AHU", [`Check ${name}`], [asset("A-1", null, name)])];
    const all = text(await render({ customerName: name, scope: { kind: "listed", recordedOn: null, types } }));
    expect(all.split(winAnsi(name)).length - 1).toBe(3);
    const straight = text(await render({ customerName: "Rénée's Café" }));
    expect(straight).toContain("Rénée's Café");
  });
});
