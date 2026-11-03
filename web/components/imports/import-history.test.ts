import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ImportHistoryRow, ImportJobStatus } from "@/application/ports";

vi.mock("next/navigation", () => ({ usePathname: () => "/imports" }));

const { ImportHistoryView } = await import("./import-history");

const SITE = "00000000-0000-4000-8000-0000000000a1";
const CUSTOMER = "00000000-0000-4000-8000-0000000000c1";

const row = (id: string, status: ImportJobStatus, extra: Partial<ImportHistoryRow> = {}): ImportHistoryRow => ({
  id,
  originalName: `${id}.csv`,
  sizeBytes: 2048,
  status,
  uploadedBy: "ana@example.test",
  createdAt: new Date("2026-10-27T18:00:00Z"),
  outcome: null,
  extraction: null,
  site: { id: SITE, name: "Tower A" },
  customer: { id: CUSTOMER, name: "Harbourview Strata" },
  ...extra,
});

const SEVEN: ImportHistoryRow[] = [
  row("j-uploading", "uploading"),
  row("j-uploaded", "uploaded"),
  row("j-parsed", "parsed", { outcome: { status: "parsed", tables: 2, rows: 15 } }),
  row("j-unreadable", "unreadable", { outcome: { status: "unreadable", reason: "no_table" } }),
  row("j-extracting", "extracting", { extraction: { status: "extracting", cursor: 2, total: 3 } }),
  row("j-extracted", "extracted", { extraction: { status: "extracted", rows: 40, unmatched: 3 } }),
  row("j-committed", "committed", { committed: { added: 336, skipped: 2 } }),
];

const SITES = [{ id: SITE, name: "Tower A", customer: "Harbourview Strata" }];
const render = (rows: ImportHistoryRow[], filter = {}) => renderToStaticMarkup(createElement(ImportHistoryView, { rows, sites: SITES, filter }));
/** The markup of one row: the list item that names the file. */
const item = (html: string, id: string) => html.split("<li").find((part) => part.includes(`${id}.csv`)) ?? "";

describe("ImportHistoryView", () => {
  test.each([
    ["j-uploading", null],
    ["j-uploaded", null],
    ["j-parsed", "15 rows in 2 tables"],
    ["j-unreadable", "No table with column headings was found."],
    ["j-extracting", "2 of 3"],
    ["j-extracted", "40 rows, 3 need an equipment type"],
    ["j-committed", "Added to site: 336 assets, 2 skipped"],
  ])("C1389: the outcome line of %s is %j", (id, line) => {
    const html = item(render(SEVEN), id);
    expect(html).not.toBe("");
    if (line) expect(html).toContain(line);
    else expect(html).not.toMatch(/rows? in|of \d|Added to site:|No table/);
  });

  test.each([
    ["j-uploading", "Upload not finished", false],
    ["j-uploaded", "Uploaded", false],
    ["j-parsed", "Read", false],
    ["j-unreadable", "Can&#x27;t read", false],
    ["j-extracting", "Extracting", false],
    ["j-extracted", "Extracted", true],
    ["j-committed", "Added to site", true],
  ])("C1390: %s shows the pill %s and review link: %s", (id, label, review) => {
    const html = item(render(SEVEN), id);
    expect(html).toContain(`>${label}<`);
    if (review) {
      expect(html).toContain(`href="/imports/${id}"`);
      expect(html).toContain("Review rows");
      expect(html).not.toContain("Open on site");
    } else {
      expect(html).toContain(`href="/sites/${SITE}/import"`);
      expect(html).toContain("Open on site");
      expect(html).not.toContain("Review rows");
    }
  });

  test("C1391: the site and customer link to their pages and a missing uploader reads Former member", () => {
    const html = item(render([row("j-1", "uploaded", { uploadedBy: null })]), "j-1");
    expect(html).toContain(`href="/sites/${SITE}"`);
    expect(html).toContain(">Tower A<");
    expect(html).toContain(`href="/customers/${CUSTOMER}"`);
    expect(html).toContain(">Harbourview Strata<");
    expect(html).toContain("Former member");
    expect(item(render([row("j-2", "uploaded")]), "j-2")).toContain("ana@example.test");
  });

  test("C1392: no read, extract or discard control and only the filter form's submit button", () => {
    const html = render(SEVEN);
    for (const text of ["Read file", "Extract equipment", "Discard"]) expect(html).not.toContain(text);
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Apply filters</);
  });

  test("C1402: no rows and no filter shows No imports yet with a link to /sites", () => {
    const html = render([]);
    expect(html).toContain("No imports yet");
    expect(html).toMatch(/<a[^>]*href="\/sites"[^>]*>/);
    expect(html).not.toContain("Clear filters");
  });

  test("C1403: no rows with a filter shows the no-match panel and Clear filters to /imports; rows show no Clear filters", () => {
    const html = render([], { status: "attention" });
    expect(html).toContain("No imports match these filters");
    expect(html).toMatch(/<a[^>]*href="\/imports"[^>]*>Clear filters</);
    expect(render([row("j-1", "uploaded")])).not.toContain("Clear filters");
  });

  test("C1404: the form is a GET to /imports with the status and site selects following the filter", () => {
    const html = render([row("j-1", "uploaded")], { status: "unreadable", siteId: SITE });
    expect(html).toMatch(/<form[^>]*method="get"/i);
    expect(html).toMatch(/<form[^>]*action="\/imports"/i);
    const values = (select: string) => [...select.matchAll(/<option[^>]*value="([^"]*)"/g)].map((m) => m[1]);
    const status = html.match(/<select[^>]*name="status"[\s\S]*?<\/select>/)?.[0] ?? "";
    expect(values(status)).toEqual(["", "attention", "uploaded", "parsed", "unreadable", "extracting", "extracted", "committed"]);
    expect(status).toMatch(/<option[^>]*selected=""[^>]*value="unreadable"|<option[^>]*value="unreadable"[^>]*selected=""/);
    const site = html.match(/<select[^>]*name="site"[\s\S]*?<\/select>/)?.[0] ?? "";
    expect(values(site)).toEqual(["", SITE]);
    expect(site).toContain("Harbourview Strata");
    expect(site).toMatch(new RegExp(`<option[^>]*selected=""[^>]*value="${SITE}"|<option[^>]*value="${SITE}"[^>]*selected=""`));
  });
});
