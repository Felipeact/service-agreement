import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { PipelineCard } from "@/application/ports";
import { PipelineView } from "./pipeline-view";
import { KanbanCard } from "./kanban-card";

const card = (patch: Partial<PipelineCard> = {}): PipelineCard => ({
  id: "a1",
  stage: "in_progress",
  site: "Harbourview Tower A",
  customer: "Harbourview Towers Strata",
  number: "AG-1048",
  versionNo: 3,
  ageDays: 9,
  isRenewal: false,
  status: "draft",
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

  test("C118: with no agreements it shows the empty panel and no disabled New agreement", () => {
    const html = render([]);
    expect(html).toContain("No agreements yet");
    expect(html).toContain("Agreements you create appear here by stage.");
    expect(html).not.toContain("No agreements match");
    const writer = renderToStaticMarkup(createElement(PipelineView, { cards: [], canCreate: true }));
    expect(writer).not.toMatch(/<button[^>]*disabled[^>]*>New agreement</);
    expect(writer).toContain(">New agreement<");
  });

  test("C1359: for a writer New agreement is a link to /agreements/new, on the board and on the empty board", () => {
    for (const cards of [[], [card()]]) {
      const html = renderToStaticMarkup(createElement(PipelineView, { cards, canCreate: true }));
      expect(html).toMatch(/<a\b[^>]*href="\/agreements\/new"[^>]*>(?:<svg[\s\S]*?<\/svg>)?New agreement</);
      expect(html).not.toMatch(/<[^>]*\sdisabled(?:=|\s|>)[^>]*>New agreement</);
    }
  });

  test("C1360: without the right to create, the Pipeline header has no New agreement", () => {
    expect(render([card()])).not.toContain("New agreement");
    expect(renderToStaticMarkup(createElement(PipelineView, { cards: [card()], canCreate: false }))).not.toContain("New agreement");
  });

  test("C746: each card is a link to its agreement page", () => {
    const html = render([card({ id: "a1" }), card({ id: "a2" }), card({ id: "a3", stage: "sent" })]);
    const cards = [...html.matchAll(/<a\b[^>]*\bdata-card\b[^>]*>/g)].map((m) => m[0]);
    expect(cards).toHaveLength(3);
    expect(cards.map((tag) => /\bhref="([^"]*)"/.exec(tag)?.[1])).toEqual(["/agreements/a1", "/agreements/a2", "/agreements/a3"]);
  });

  test("C1054: the card opens with its number and age, then the site as its heading with the customer on the next line", () => {
    const html = render([card({ site: "Harbourview Tower A", customer: "Harbourview Towers Strata", number: "AG-1048", versionNo: 3 })]);
    const heading = /<h3\b[^>]*>([^<]*)<\/h3>/.exec(html);
    expect(heading?.[1]).toBe("Harbourview Tower A");
    expect(html.indexOf("AG-1048 · v3")).toBeLessThan(heading?.index ?? 0);
    const afterHeading = html.slice((heading?.index ?? 0) + (heading?.[0].length ?? 0));
    expect(afterHeading).toMatch(/^<[^>]+>Harbourview Towers Strata</);
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

describe("PipelineView: follow-up", () => {
  const shownIds = (html: string) => [...html.matchAll(/<a\b[^>]*\bhref="\/agreements\/([^"]*)"/g)].map((m) => m[1]);
  const stuck = () => [
    card({ id: "fresh", stage: "sent", status: "sent", ageDays: 2 }),
    card({ id: "stale", stage: "sent", status: "sent", ageDays: 9 }),
    card({ id: "oldest", stage: "sent", status: "sent", ageDays: 30 }),
    card({ id: "done", stage: "completed", status: "accepted", ageDays: 90, annualCents: 1880000, visitsPerYear: 4 }),
  ];

  test("a card that has sat too long says what to chase, and a fresh one says nothing", () => {
    const html = render(stuck());
    expect(html).toMatch(/data-tone="attention"[^>]*>No reply in 9 days</);
    expect(html).toMatch(/data-tone="attention"[^>]*>No reply in 30 days</);
    expect(html).not.toContain("No reply in 2 days");
  });

  test("a closed card never asks for a follow-up, however old", () => {
    expect(column(render(stuck()), "completed")).not.toContain('data-tone="attention"');
  });

  test("an open column lists the longest-waiting deal first", () => {
    const sent = column(render(stuck()), "sent");
    expect(shownIds(sent)).toEqual(["oldest", "stale", "fresh"]);
  });

  test("a column header counts how many cards need a follow-up", () => {
    expect(column(render(stuck()), "sent")).toMatch(/data-column-follow-up[^>]*>.*2 to follow up</);
    expect(column(render(stuck()), "in_progress")).not.toContain("data-column-follow-up");
  });

  test("the Follow-ups due card counts the cards that qualify, starts off, and is the board's filter", () => {
    const html = render(stuck());
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*data-summary="follow-ups"|<button[^>]*data-summary="follow-ups"[^>]*aria-pressed="false"/);
    expect(html).toMatch(/Follow-ups due[\s\S]*?<span[^>]*text-\[32px\][^>]*>2</);
  });

  test("the first card is the open money, the second the cards waiting on the customer", () => {
    const html = render([...stuck(), card({ id: "draft", annualCents: 500000, visitsPerYear: 4 })]);
    expect(html).toMatch(/Open pipeline[\s\S]*?\$5,000/);
    expect(html).toMatch(/Waiting on customer[\s\S]*?text-\[32px\][^>]*>3</);
    expect(html).toContain("4 agreements in motion");
  });

  test("the page title is the greeting it is given", () => {
    expect(renderToStaticMarkup(createElement(PipelineView, { cards: [card()], title: "Good morning, Jamie" }))).toMatch(/<h1[^>]*>Good morning, Jamie</);
  });

  test("Expiring soon is a sixth column after Refused, with its own cards and a link to the full list", () => {
    const row = { id: "x1", number: "AG-1004", site: "Harbourview Towers", customer: "Harbourview Strata", termEnd: "2027-12-31", noticeDate: "2027-12-15", annualCents: 119999, renewal: null, openAgreement: null };
    const html = renderToStaticMarkup(createElement(PipelineView, { cards: [card()], expiring: [row], today: "2027-12-01" }));
    const order = [...html.matchAll(/data-column="([a-z_]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["in_progress", "sent", "accepted", "completed", "refused", "expiring"]);
    const expiring = column(html, "expiring");
    expect(expiring).toContain("Harbourview Towers");
    expect(expiring).toContain("$1,199.99/yr");
    expect(expiring).toContain("30d");
    expect(expiring).toMatch(/<a[^>]*href="\/pipeline\?view=expiring"[^>]*>Expiring soon<\/a>/);
  });

  test("with nothing ending the Expiring soon column says so", () => {
    expect(column(render([card()]), "expiring")).toContain("Nothing ends in the next 90 days");
  });

  const importJob = (patch: Record<string, unknown> = {}) =>
    ({
      id: "j1",
      siteId: "s1",
      originalName: "Juniper HVAC list.csv",
      sizeBytes: 2048,
      status: "extracted",
      createdAt: new Date("2026-11-05T00:00:00Z"),
      uploadedBy: "a@x.test",
      outcome: { status: "parsed", tables: 1, rows: 31 },
      extraction: { status: "extracted", rows: 31, unmatched: 4, cursor: 1, total: 1 },
      committed: null,
      site: { id: "s1", name: "Juniper Medical Pavilion" },
      customer: { id: "c1", name: "Juniper Health" },
      ...patch,
    }) as never;

  test("Recent equipment imports names the newest lists with how much was recognized, and links to all of them", () => {
    const html = renderToStaticMarkup(createElement(PipelineView, { cards: [card()], imports: [importJob(), importJob({ id: "j2", originalName: "Riverside.xlsx", status: "uploaded", extraction: undefined })] }));
    expect(html).toContain("Recent equipment imports");
    expect(html).toContain("Messy files, structured into priceable assets.");
    expect(html).toContain("Juniper HVAC list.csv");
    expect(html).toContain("Juniper Medical Pavilion · Juniper Health");
    expect(html).toContain("27 of 31 rows recognized");
    expect(html).toMatch(/<a[^>]*href="\/imports"[^>]*>View all<\/a>/);
    // a reviewable list links to its rows, any other to the site's import page
    expect(html).toMatch(/<a[^>]*href="\/imports\/j1"/);
    expect(html).toMatch(/<a[^>]*href="\/sites\/s1\/import"/);
  });

  test("only the three newest imports are named, and with none the panel is left out", () => {
    const many = ["a", "b", "c", "d", "e"].map((id) => importJob({ id }));
    expect((renderToStaticMarkup(createElement(PipelineView, { cards: [card()], imports: many })).match(/data-import=/g) ?? []).length).toBe(3);
    expect(renderToStaticMarkup(createElement(PipelineView, { cards: [card()] }))).not.toContain("Recent equipment imports");
  });

  test("opened from the bell the board starts on the agreements that need follow-up", () => {
    const html = renderToStaticMarkup(createElement(PipelineView, { cards: [card({ id: "late", stage: "sent", status: "sent", ageDays: 20 }), card({ id: "fresh", stage: "sent", status: "sent", ageDays: 1 })], initialFollowUpOnly: true }));
    expect(html).toContain("/agreements/late");
    expect(html).not.toContain("/agreements/fresh");
    expect(html).toMatch(/aria-pressed="true"[^>]*data-summary="follow-ups"|data-summary="follow-ups"[^>]*aria-pressed="true"/);
  });

  test("there is no search on the board: the sidebar's is the app's one", () => {
    expect(render([card()])).not.toContain("type=\"search\"");
  });

  test("with no agreements there are no summary cards", () => {
    expect(render([])).not.toContain("Follow-ups due");
  });

  test("a closed column's total says what the money was", () => {
    const html = render([
      ...stuck(),
      card({ id: "no", stage: "refused", status: "refused", annualCents: 3148000, visitsPerYear: 4 }),
    ]);
    expect(column(html, "completed")).toMatch(/data-column-total[^>]*>\$18,800\/yr<\/span><span[^>]*>signed</);
    expect(column(html, "refused")).toMatch(/data-column-total[^>]*>\$31,480\/yr<\/span><span[^>]*>not won</);
    expect(column(html, "sent")).not.toContain("not won");
  });

  test("an empty column says what it would hold", () => {
    const html = render(stuck());
    expect(column(html, "accepted")).toContain("Nothing is waiting on a signature");
    expect(column(html, "in_progress")).toContain("No drafts in progress");
  });
});

describe("KanbanCard: lines that earn their place", () => {
  const html = (patch: Partial<PipelineCard>) => renderToStaticMarkup(createElement(KanbanCard, { card: card(patch) }));

  test("a site named after its customer shows the name once", () => {
    const out = html({ site: "Fernwood Dental", customer: "fernwood dental" });
    expect(out.match(/Fernwood Dental/gi)).toHaveLength(1);
  });

  test("a card with no service lines says so instead of showing no money", () => {
    expect(html({})).toContain("No service lines yet");
    expect(html({ annualCents: 100000, visitsPerYear: 4 })).not.toContain("No service lines yet");
  });
});

describe("KanbanCard: the renewal marker", () => {
  const html = (isRenewal: boolean) => renderToStaticMarkup(createElement(KanbanCard, { card: card({ isRenewal }) }));

  test("C1207: a renewal's card shows the marker Renewal", () => {
    expect(html(true)).toMatch(/>Renewal</);
  });

  test("C1207: any other card shows no such text", () => {
    expect(html(false)).not.toContain("Renewal");
  });
});

describe("KanbanCard: the expiry marker", () => {
  const html = (status: PipelineCard["status"]) => renderToStaticMarkup(createElement(KanbanCard, { card: card({ stage: "refused", status }) }));

  test("C1261: an expired agreement's card shows a neutral Expired pill", () => {
    expect(html("expired")).toMatch(/>Expired</);
  });

  test("C1261: a refused agreement's card shows none", () => {
    expect(html("refused")).not.toContain("Expired");
  });
});
