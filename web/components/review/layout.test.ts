import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import type { PortalView } from "@/application/ports";
import { portalDocument } from "@/application/use-cases";
import { ReviewView } from "./review-view";

const html = (view: PortalView) =>
  renderToStaticMarkup(createElement(ReviewView, { token: "t", view, state: "open", actions: { decide: async () => ({ status: "idle" as const }), record: async () => undefined } }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, "\n").replace(/&#x27;/g, "'").replace(/\n+/g, "\n");
const headings = (markup: string) => [...markup.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1].replace(/&#x27;/g, "'"));

type Layout = unknown[];
const body = (layout: Layout, doc: Record<string, unknown> = {}) => ({
  schema: 2,
  name: "Layout",
  description: "",
  doc: { title: "Agreement", showMeta: true, pageHeader: "first", pageFooter: "number", ...doc },
  layout,
  preset: { termMonths: null, lines: [] },
});
const price = (options?: unknown) => ({ kind: "section", key: "price", ...(options ? { options } : {}) });
const section = (key: string, options?: unknown) => ({ kind: "section", key, ...(options ? { options } : {}) });
const para = (value: string) => ({ kind: "block", type: "paragraph", text: value });
const heading = (value: string) => ({ kind: "block", type: "heading", text: value, level: 2 });

describe("the review page draws the layout of the version's template", () => {
  test("C5509: the same items, titles and order as the PDF of the same view, with a section moved before the price table and a title option", () => {
    const layout = [
      heading("About this agreement"),
      section("included", { title: "Work included" }),
      para("Welcome {{customer.name}}."),
      price({ title: "CHARGE" }),
      section("equipment", { title: "LIST" }),
      section("schedule", { title: "WHEN WE VISIT" }),
      section("terms"),
      para("Thank you."),
    ];
    const view = portalView({ template: body(layout) });
    const page = html(view);
    const shown = text(page);

    // The PDF's document holds the items the PDF draws, in order; the page draws the same, each under the same title.
    const pdf = portalDocument(view)?.layout ?? [];
    expect(pdf.map((item) => (item.kind === "section" ? item.key : item.text))).toEqual([
      "About this agreement",
      "included",
      "Welcome Fernwood Dental.",
      "price",
      "equipment",
      "schedule",
      "terms",
      "Thank you.",
    ]);
    const markers = ["About this agreement", "Work included", "Welcome Fernwood Dental.", "CHARGE", "LIST", "WHEN WE VISIT", "Terms", "Thank you."];
    const positions = markers.map((marker) => shown.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(shown.indexOf("Work included")).toBeLessThan(shown.indexOf("CHARGE"));
    // Each region carries the title as its heading, and the defaults are gone.
    expect(headings(page)).toEqual(expect.arrayContaining(["Work included", "CHARGE", "LIST", "WHEN WE VISIT"]));
    for (const gone of ["Service included", "Service lines", "Visit schedule"]) expect(headings(page)).not.toContain(gone);
  });

  test("C5527: the review page resolves tenant.address, tenant.phone and term.start in a block's text, as the PDF does", () => {
    const view = portalView({
      template: body([para("Write to {{tenant.address}}."), para("Call {{tenant.phone}} to reach us."), para("Starting {{term.start}}."), price()]),
      term: { start: "2026-11-13", months: 12, end: "2027-11-12" },
    });
    const shown = text(html(view));
    expect(shown).toContain("Write to 100 Sample Street, Burnaby, BC.");
    expect(shown).toContain("Call 604-555-0100 to reach us.");
    expect(shown).toContain("Starting November 13, 2026.");
    expect(shown).not.toContain("{{");
    expect(portalDocument(view)?.layout?.map((item) => (item.kind === "block" ? item.text : item.key))).toContain("Starting November 13, 2026.");
  });

  test("C5509: a section absent from the layout is not drawn on the page, as on the PDF", () => {
    const view = portalView({ template: body([price(), para("Only this.")]) });
    const shown = text(html(view));
    for (const absent of ["Visit schedule", "Service included", "Equipment", "Repair discount"]) expect(shown, absent).not.toContain(absent);
    expect(shown).toContain("Total per year");
    expect(portalDocument(view)?.layout?.map((item) => (item.kind === "section" ? item.key : "block"))).toEqual(["price", "block"]);
  });

  test("C5509: a view pinned to a schema 1 body shows the sections it always showed, in the order it showed them", () => {
    const shown = text(html(portalView()));
    const positions = ["Service lines", "Total per year", "Visit schedule", "Service included", "Equipment", "Terms", "Your answer"].map((marker) => shown.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test("C5517: a title option replaces the default title of price, schedule, included and equipment on the page, and no option draws the defaults", () => {
    const titled = headings(html(portalView({ template: body([price({ title: "CHARGE" }), section("schedule", { title: "WHEN" }), section("included", { title: "Included:" }), section("equipment", { title: "LIST" })]) })));
    for (const title of ["CHARGE", "WHEN", "Included:", "LIST"]) expect(titled, title).toContain(title);
    for (const gone of ["Service lines", "Visit schedule", "Service included", "Equipment"]) expect(titled, gone).not.toContain(gone);
    const defaults = headings(html(portalView({ template: body([price(), section("schedule"), section("included"), section("equipment")]) })));
    for (const title of ["Service lines", "Visit schedule", "Service included", "Equipment"]) expect(defaults, title).toContain(title);
  });

  test("C5517: the org's word replaces Equipment in the default title of the equipment section", () => {
    const view = portalView({ template: body([price(), section("equipment")]) });
    const stations = { ...view, tenant: { ...view.tenant!, words: { singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" } } } as PortalView;
    expect(headings(html(stations))).toContain("Stations");
  });

  test("C5517: the frequency and capital letters of the included section reach the page, and price columns and the visits format too", () => {
    const view = portalView({
      template: body([
        section("included", { showFrequency: true, uppercase: true }),
        price({ columns: { description: "ITEM", visits: "TIMES", perVisit: "EACH", perYear: "YEAR", total: "TOTAL" }, visitsFormat: "times_per_year" }),
      ]),
    });
    const shown = text(html(view));
    expect(shown).toContain("ROOFTOP UNIT (QUARTERLY)");
    for (const label of ["ITEM", "TIMES", "EACH", "YEAR", "TOTAL"]) expect(shown, label).toContain(label);
    expect(shown).toContain("4 times per year");
    expect(shown).toContain("2 times per year");
  });
});
