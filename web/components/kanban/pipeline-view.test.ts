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
