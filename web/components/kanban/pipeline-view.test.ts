import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { PipelineCard } from "@/application/ports";
import { PipelineView } from "./pipeline-view";

const card = (patch: Partial<PipelineCard> = {}): PipelineCard => ({
  id: "a1",
  stage: "in_progress",
  site: "Harbourview Tower A",
  customer: "Harbourview Towers Strata",
  number: "AG-1048",
  versionNo: 3,
  ageDays: 9,
  ...patch,
});

const render = (cards: PipelineCard[]) => renderToStaticMarkup(createElement(PipelineView, { cards })).replace(/&#x27;/g, "'");

/** The markup of one column, from its opening tag to the next column. */
function column(html: string, stage: string) {
  const start = html.indexOf(`data-column="${stage}"`);
  const end = html.indexOf("data-column=", start + 1);
  return html.slice(start, end === -1 ? undefined : end);
}

describe("PipelineView", () => {
  test("C112: a column header shows its count and its annual total", () => {
    const html = render([card({ id: "a", annualCents: 1428050 }), card({ id: "b", annualCents: 2160000 })]);
    const inProgress = column(html, "in_progress");
    expect(inProgress).toMatch(/data-column-count[^>]*>2</);
    expect(inProgress).toContain("$35,880.50/yr");
    expect(column(html, "sent")).toMatch(/data-column-count[^>]*>0</);
  });

  test("C113: the card shows number, version and age", () => {
    const html = render([card()]);
    expect(html).toContain("Harbourview Towers Strata");
    expect(html).toContain("AG-1048 · v3");
    expect(html).toContain("Updated 9 days ago");
  });

  test.each([
    [1, "Updated 1 day ago"],
    [0, "Updated today"],
  ])("C113: an age of %s days reads %s", (ageDays, label) => {
    expect(render([card({ ageDays })])).toContain(label);
  });

  test("C113: a card without a number reads Unnumbered", () => {
    expect(render([card({ number: null, versionNo: 2 })])).toContain("Unnumbered · v2");
  });

  test("C116: a card without amounts still counts but adds nothing to the total", () => {
    const html = render([card({ id: "a" }), card({ id: "b", visitsPerYear: 4, annualCents: 400000 })]);
    const inProgress = column(html, "in_progress");
    expect(inProgress).toMatch(/data-column-count[^>]*>2</);
    expect(inProgress).toContain("$4,000/yr");
    expect(inProgress.match(/visits\/yr/g)).toHaveLength(1);
  });

  test("C117: an attention label renders as an attention pill", () => {
    const html = render([card({ attention: "Changes requested" }), card({ id: "b", stage: "accepted", attention: "Awaiting countersignature" })]);
    expect(html).toMatch(/data-tone="attention"[^>]*>Changes requested</);
    expect(html).toMatch(/data-tone="attention"[^>]*>Awaiting countersignature</);
  });

  test("C118: with no agreements it shows the empty panel and a disabled New agreement", () => {
    const html = render([]);
    expect(html).toContain("No agreements yet");
    expect(html).toContain("Agreements you create appear here by stage.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>New agreement</);
    expect(html).not.toContain("No agreements match");
  });

  test("C746: each card is a link to its agreement page", () => {
    const html = render([card({ id: "a1" }), card({ id: "a2" }), card({ id: "a3", stage: "sent" })]);
    const cards = [...html.matchAll(/<a\b[^>]*\bdata-card\b[^>]*>/g)].map((m) => m[0]);
    expect(cards).toHaveLength(3);
    expect(cards.map((tag) => /\bhref="([^"]*)"/.exec(tag)?.[1])).toEqual(["/agreements/a1", "/agreements/a2", "/agreements/a3"]);
  });

  test("C1054: the card heading is the site, with the customer on the next line before number and version", () => {
    const html = render([card({ site: "Harbourview Tower A", customer: "Harbourview Towers Strata", number: "AG-1048", versionNo: 3 })]);
    const heading = /<h3\b[^>]*>([^<]*)<\/h3>/.exec(html);
    expect(heading?.[1]).toBe("Harbourview Tower A");
    const afterHeading = html.slice((heading?.index ?? 0) + (heading?.[0].length ?? 0));
    expect(afterHeading).toMatch(/^<[^>]+>Harbourview Towers Strata</);
    expect(afterHeading.indexOf("Harbourview Towers Strata")).toBeLessThan(afterHeading.indexOf("AG-1048 · v3"));
  });

  test("C1055: a long site name is never truncated", () => {
    const longSite = "North Shore Regional Health Authority Administrative Campus Building C Mechanical Penthouse and Parkade Level";
    const site = `${longSite}${"x".repeat(120 - longSite.length)}`;
    expect(site).toHaveLength(120);
    const html = render([card({ site })]);
    const heading = /<h3\b([^>]*)>([^<]*)<\/h3>/.exec(html);
    expect(heading?.[2]).toBe(site);
    const classes = /class="([^"]*)"/.exec(heading?.[1] ?? "")?.[1].split(/\s+/) ?? [];
    expect(classes.filter((name) => /^(truncate|line-clamp-.*|whitespace-nowrap|overflow-hidden)$/.test(name))).toEqual([]);
  });

  const searchBoard = () => [
    card({ id: "a", site: "Harbourview Tower A", customer: "Harbourview Towers Strata" }),
    card({ id: "b", site: "Fernwood Clinic", customer: "Fernwood Dental" }),
    card({ id: "c", site: "Main office", customer: "Kestrel Logistics" }),
  ];
  const shownIds = (html: string) => [...html.matchAll(/<a\b[^>]*\bhref="\/agreements\/([^"]*)"/g)].map((m) => m[1]);
  const renderQuery = (cards: PipelineCard[], initialQuery: string) =>
    renderToStaticMarkup(createElement(PipelineView, { cards, initialQuery })).replace(/&#x27;/g, "'");

  test.each([
    ["  CLINIC ", ["b"]],
    ["kestrel", ["c"]],
    ["harbourview", ["a"]],
  ])("C1056: the query %j matches site or customer and shows %j", (query, ids) => {
    expect(shownIds(renderQuery(searchBoard(), query))).toEqual(ids);
  });

  test("C1057: a query matching no site or customer shows the no-match state and no card", () => {
    const html = renderQuery(searchBoard(), "zzz");
    expect(html).toContain("No agreements match &quot;zzz&quot;");
    expect(html).toMatch(/<button[^>]*>Clear search</);
    expect(shownIds(html)).toEqual([]);
  });

  test("C1058: under a query each column header counts and totals only its matching cards", () => {
    const html = renderQuery(
      [
        card({ id: "a", site: "Fernwood Clinic", customer: "Fernwood Dental", annualCents: 400000 }),
        card({ id: "b", site: "Main office", customer: "Kestrel Logistics", annualCents: 1000000 }),
        card({ id: "c", stage: "sent", site: "Fernwood Annex", customer: "Fernwood Dental", annualCents: 250000 }),
      ],
      "fernwood",
    );
    const inProgress = column(html, "in_progress");
    expect(inProgress).toMatch(/data-column-count[^>]*>1</);
    expect(inProgress).toMatch(/data-column-total[^>]*>\$4,000\/yr</);
    const sent = column(html, "sent");
    expect(sent).toMatch(/data-column-count[^>]*>1</);
    expect(sent).toMatch(/data-column-total[^>]*>\$2,500\/yr</);
  });

  test("C1059: the search input invites sites or customers and keeps its label", () => {
    const html = render([card()]);
    expect(html).toMatch(/<input[^>]*placeholder="Search sites or customers…"/);
    expect(html).toContain("Search agreements");
    expect(html).not.toContain("Search customers…");
  });

  test("C119: there is no Sample data badge and no sample data module", () => {
    expect(render([card()])).not.toContain("Sample data");
    const webRoot = path.join(__dirname, "..", "..");
    expect(existsSync(path.join(webRoot, "lib", `${["sample", "pipeline"].join("-")}.ts`))).toBe(false);

    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
      });
    const needle = ["sample", "pipeline"].join("-");
    const importers = walk(webRoot).filter((file) => readFileSync(file, "utf8").includes(`lib/${needle}`));
    expect(importers).toEqual([]);
  });
});
