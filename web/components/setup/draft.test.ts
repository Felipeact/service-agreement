import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { OrgSettings } from "@/application/ports";
import { itemWords } from "@/domain/org-settings";
import { groupSetupCatalog } from "@/domain/org-settings/setup";
import { DRAFT_ERROR_MESSAGES, DRAFT_MESSAGES, type DraftErrorCode, type DraftType } from "@/domain/task-library/draft";
import { DraftPanel } from "./draft-panel";
import { draftReducer } from "./draft-state";
import { CatalogReview, SetupView } from "./setup-view";

const settings: OrgSettings = {
  legalName: "Blue Water Pools Ltd.",
  address: null,
  phone: null,
  accentColor: null,
  repairDiscountPct: 0,
  cpiCapPct: 0,
  cancellationNoticeDays: null,
  paymentDays: null,
  governingProvince: null,
  taxNote: null,
  defaultTermMonths: 12,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30,
  itemSingular: "equipment",
  itemPlural: "equipment",
};
const words = itemWords("equipment", "equipment");
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const noop = async () => ({ status: "idle" as const });
const addTypes = async () => ({ ok: true as const, added: [] as string[] });

const TYPES: DraftType[] = [
  { name: "Pool pump", defaultVisitMonths: [4, 10], synonyms: ["pool pumps", "pump"], tasks: [{ description: "Check seals" }, { description: "Clean the basket" }, { description: "Test the timer" }] },
  { name: "Sprinkler head", defaultVisitMonths: [5], synonyms: [], tasks: [{ description: "Test spray" }] },
];

const panel = (props: Record<string, unknown> = {}) => html(createElement(DraftPanel, { addTypes, onAdded: () => {}, ...props }));
const view = (draft?: Record<string, unknown>, groups = groupSetupCatalog([], words)) =>
  html(createElement(SetupView, { settings, groups, words, action: noop, ...(draft && { draft: { addTypes, ...draft } }) }));
const addButton = (markup: string) => markup.match(/<button[^>]*>\s*Add to my catalog\s*<\/button>/)?.[0] ?? "";

afterEach(() => vi.unstubAllGlobals());

describe("draft review", () => {
  test("C3416: each type is a card with its name, its months marked, its spellings and its tasks in order, and says nothing is added yet", () => {
    const markup = panel({ initialTypes: TYPES });
    expect(markup).toContain("Nothing is added until you press Add to my catalog");
    for (const text of ["Pool pump", "Sprinkler head", "pool pumps, pump", "Check seals", "Clean the basket", "Test the timer", "Test spray"]) expect(markup).toContain(text);
    expect(markup.indexOf("Check seals")).toBeLessThan(markup.indexOf("Clean the basket"));
    expect(markup.indexOf("Clean the basket")).toBeLessThan(markup.indexOf("Test the timer"));
    expect(markup.indexOf("Test the timer")).toBeLessThan(markup.indexOf("Sprinkler head"));
    expect((markup.match(/type="checkbox"/g) ?? []).length).toBe(24);
    expect((markup.match(/checked=""/g) ?? []).length).toBe(3);
    for (const month of ["Jan", "Apr", "Oct", "Dec"]) expect(markup).toContain(month);
  });

  test("C3417: every edit changes only the draft and calls neither fetch nor anything else", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const before = structuredClone(TYPES);

    expect(draftReducer(TYPES, { type: "rename", index: 0, name: "Heated pump" })[0].name).toBe("Heated pump");
    expect(draftReducer(TYPES, { type: "editTask", index: 0, task: 1, text: "Rinse the basket" })[0].tasks[1].description).toBe("Rinse the basket");
    expect(draftReducer(TYPES, { type: "setSynonyms", index: 0, raw: "heater, boiler" })[0].synonyms).toEqual(["heater", "boiler"]);
    expect(draftReducer(TYPES, { type: "toggleMonth", index: 1, month: 7 })[1].defaultVisitMonths).toEqual([5, 7]);
    expect(draftReducer(TYPES, { type: "toggleMonth", index: 0, month: 4 })[0].defaultVisitMonths).toEqual([10]);
    expect(draftReducer(TYPES, { type: "removeTask", index: 0, task: 0 })[0].tasks.map((t) => t.description)).toEqual(["Clean the basket", "Test the timer"]);
    const removed = draftReducer(TYPES, { type: "removeType", index: 0 });
    expect(removed.map((t) => t.name)).toEqual(["Sprinkler head"]);

    expect(TYPES).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("C3418: a type with a bad name, no task or no month shows its own error and disables Add; a valid draft enables it", () => {
    const bad = (over: Partial<DraftType>) => panel({ initialTypes: [{ ...TYPES[0], ...over }] });
    for (const [over, message] of [
      [{ name: "  " }, DRAFT_MESSAGES.name],
      [{ name: "x".repeat(61) }, DRAFT_MESSAGES.name],
      [{ tasks: [] }, DRAFT_MESSAGES.tasks],
      [{ tasks: [{ description: "" }] }, DRAFT_MESSAGES.tasks],
      [{ defaultVisitMonths: [] }, DRAFT_MESSAGES.months],
    ] as [Partial<DraftType>, string][]) {
      const markup = bad(over);
      expect(markup, message).toContain(message);
      expect(addButton(markup)).toMatch(/ disabled=""/);
    }
    const good = panel({ initialTypes: TYPES });
    expect(good).not.toContain(DRAFT_MESSAGES.name);
    expect(addButton(good)).not.toBe("");
    expect(addButton(good)).not.toMatch(/ disabled=""/);
  });

  test("C3433: a shown draft says it was written by AI, that the contractor owns the checklists and to check them against their procedures and any code or regulation", () => {
    const markup = panel({ initialTypes: TYPES });
    expect(markup).toMatch(/written by AI/);
    expect(markup).toMatch(/you own your checklists/i);
    expect(markup).toMatch(/your own procedures/);
    expect(markup).toMatch(/any code or regulation that applies/);
    expect(panel()).not.toMatch(/written by AI/);
  });
});

describe("draft panel on /setup", () => {
  test("C3428: the panel sits above What we set up, with a description field, a PDF and Word file input and Draft my catalog", () => {
    const markup = view({});
    expect(markup).toContain("Draft my catalog");
    expect(markup.indexOf('id="draft-title"')).toBeGreaterThan(-1);
    expect(markup.indexOf('id="draft-title"')).toBeLessThan(markup.indexOf('id="catalog-title"'));
    expect(markup).toMatch(/<textarea[^>]*id="draft-description"/);
    const file = markup.match(/<input[^>]*id="draft-file"[^>]*>/)?.[0] ?? "";
    expect(file).toContain(".pdf");
    expect(file).toContain(".docx");
    expect(file).toContain("application/pdf");
  });

  test("C3429: without the draft the screen has no Draft my catalog and What we set up is the CatalogReview markup", () => {
    const groups = groupSetupCatalog([], words);
    const markup = view(undefined, groups);
    expect(markup).not.toContain("Draft my catalog");
    expect(markup).not.toContain("draft-title");
    expect(markup).toContain(html(createElement(CatalogReview, { groups, words })));
  });

  test("C3430: with Other and seeded types the panel and the seeded types both show", () => {
    const groups = groupSetupCatalog([{ pack: "plumbing", name: "Backflow preventer" }, { pack: "plumbing", name: "Water heater" }], words);
    const markup = view({}, groups);
    expect(markup).toContain("Draft my catalog");
    expect(markup).toContain("Backflow preventer");
    expect(markup).toContain("Water heater");
    expect(markup).toContain("Plumbing");
  });

  test("C3431: while drafting the button is disabled and says so, and Continue and Skip stay enabled", () => {
    const markup = view({ initialPending: true });
    const draftButton = markup.match(/<button[^>]*>\s*Drafting, this can take up to a minute\s*<\/button>/)?.[0] ?? "";
    expect(draftButton).toMatch(/ disabled=""/);
    for (const label of ["Continue", "Skip for now"]) {
      const button = markup.match(new RegExp(String.raw`<button[^>]*>\s*${label}\s*</button>`))?.[0] ?? "";
      expect(button, label).not.toBe("");
      expect(button, label).not.toMatch(/ disabled=""/);
    }
  });

  test("C3432: each of the nine error codes shows its own message and keeps the description and the chosen file", () => {
    const codes = Object.keys(DRAFT_ERROR_MESSAGES) as DraftErrorCode[];
    expect(codes).toHaveLength(9);
    const seen = new Set<string>();
    for (const code of codes) {
      const markup = panel({ initialError: { code }, initialDescription: "We service heated pools", initialFileName: "proposal.pdf" });
      expect(markup, code).toContain(DRAFT_ERROR_MESSAGES[code]);
      expect(markup, code).toContain("We service heated pools");
      expect(markup, code).toContain("proposal.pdf");
      expect(markup, code).toMatch(/role="alert"/);
      seen.add(DRAFT_ERROR_MESSAGES[code]);
    }
    expect(seen.size).toBe(9);
    expect(panel({ initialError: { code: "unreadable", message: "Custom words" } })).toContain("Custom words");
  });

  test("C3419: types just added show under Added from your draft, beside the seeded ones", () => {
    const groups = groupSetupCatalog([{ pack: "plumbing", name: "Water heater" }], words);
    const markup = html(createElement(CatalogReview, { groups, words, added: ["Pool pump", "Sprinkler head"] }));
    expect(markup).toContain("Added from your draft");
    expect(markup).toContain("2 equipment types");
    expect(markup).toContain("Pool pump");
    expect(markup).toContain("Water heater");
    const onlyDraft = html(createElement(CatalogReview, { groups: [], words, added: ["Pool pump"] }));
    expect(onlyDraft).not.toContain("No types yet");
    expect(onlyDraft).toContain("Added from your draft");
  });
});
