import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AssetTypeOption, ImportJobStatus, ImportJobView, ImportReview, ImportRowView } from "@/application/ports";
import { ImportJobList } from "./job-list";
import { CommitPrompt, MapPrompt, RowEditor } from "./review-controls";
import { ReviewView, type ReviewActions } from "./review-view";
import { DiscardPrompt } from "./discard-control";
import type { CommitState, MapState, RowState } from "./state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/imports" }));

const JOB = "66666666-6666-4666-8666-666666666666";
const SITE = "33333333-3333-4333-8333-333333333333";
const RTU = "type-rtu";
const MUA = "type-mua";
const TYPES: AssetTypeOption[] = [
  { id: MUA, code: "MUA", name: "Make-up Air Unit" },
  { id: RTU, code: "RTU", name: "Rooftop Unit" },
];

let next = 0;
function row(over: Partial<ImportRowView> = {}): ImportRowView {
  next += 1;
  return {
    id: `row-${next}`,
    position: next,
    assetTypeRaw: "Rooftop unit",
    assetTypeId: RTU,
    unitNo: `RTU-${next}`,
    typeModel: "Carrier 48",
    location: "Roof",
    confidence: "high",
    sourceRef: `Units!${next + 1}`,
    skipped: false,
    assetId: null,
    ...over,
  };
}
const rowsAt = (n: number) => Array.from({ length: n }, (_, i) => row({ position: i + 1, unitNo: `U-${i + 1}` }));

function review(rows: ImportRowView[], status: ImportJobStatus = "extracted", committed: ImportReview["job"]["committed"] = null): ImportReview {
  return { job: { id: JOB, siteId: SITE, siteName: "Brookhaven", originalName: "units.xlsx", status, committed }, rows };
}

const actions: ReviewActions = {
  update: () => async () => ({ status: "saved" }),
  skip: () => async () => ({ status: "saved" }),
  map: async () => ({ status: "mapped", rows: 1 }),
  commit: async () => ({ status: "committed", added: 1, skipped: 0 }),
};

type ViewOptions = { show?: "all" | "attention"; page?: string; writer?: boolean; site?: { assetTypeId: string; unitNo: string | null }[] };
const view = (r: ImportReview, { show = "all", page, writer = true, site = [] }: ViewOptions = {}) =>
  renderToStaticMarkup(createElement(ReviewView, { review: r, types: TYPES, siteAssets: site, show, page, actions: writer ? actions : undefined }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const rowPositions = (html: string) => [...html.matchAll(/data-row="(\d+)"/g)].map((m) => Number(m[1]));
const button = (html: string, label: string) => html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0];

const jobView = (status: ImportJobStatus, over: Partial<ImportJobView> = {}): ImportJobView => ({
  id: JOB,
  originalName: "units.xlsx",
  sizeBytes: 2048,
  status,
  uploadedBy: "dana@example.com",
  createdAt: new Date("2026-10-27T18:00:00Z"),
  outcome: null,
  extraction: null,
  ...over,
});
const list = (jobs: ImportJobView[], writer: boolean) =>
  renderToStaticMarkup(
    createElement(ImportJobList, {
      jobs,
      ...(writer ? { discard: () => async () => ({ status: "discarded" as const }), read: () => async () => ({ status: "not_ready" as const }), extract: async () => ({ status: "not_ready" as const }) } : {}),
    }),
  );

describe("job list", () => {
  test.each<[ImportJobStatus, boolean]>([
    ["extracted", true],
    ["committed", true],
    ["parsed", false],
    ["extracting", false],
    ["unreadable", false],
    ["uploaded", false],
    ["uploading", false],
  ])("C601: a %s job shows Review rows: %s", (status, shown) => {
    for (const writer of [true, false]) {
      const html = list([jobView(status, status === "committed" ? { committed: { added: 1, skipped: 0 } } : {})], writer);
      expect(html.includes(`href="/imports/${JOB}"`) && html.includes("Review rows")).toBe(shown);
    }
  });

  test("C635: a committed job shows a neutral Added to site pill, what was added, and no Discard", () => {
    const html = list([jobView("committed", { committed: { added: 336, skipped: 2 } })], true);
    expect(html).toMatch(/data-tone="neutral"[^>]*>Added to site</);
    expect(text(html)).toContain("Added to site: 336 assets, 2 skipped");
    expect(html).not.toContain(">Discard<");
  });
});

describe("review view", () => {
  test("C602: rows in position order with every column", () => {
    const rows = [
      row({ position: 3, assetTypeId: null, assetTypeRaw: null }),
      row({ position: 1, confidence: "low" }),
      row({ position: 2, assetTypeId: MUA, assetTypeRaw: "MAU", confidence: "medium" }),
    ];
    const html = view(review(rows));
    expect(rowPositions(html)).toEqual([1, 2, 3]);
    const out = text(html);
    expect(out).toContain("Rooftop Unit (RTU)");
    expect(out).toContain("Make-up Air Unit (MUA)");
    expect(out).toContain("Needs a type");
    for (const value of [rows[1].unitNo!, "Carrier 48", "Roof", "Low", "Medium", "High", "Units!", "MAU"]) expect(out).toContain(value);
    expect(out).toMatch(/In file\s+-/);
  });

  test("C603: counts, filter links, and only flagged included rows under Needs attention", () => {
    const rows = [
      row({ position: 1 }),
      row({ position: 2, assetTypeId: null }),
      row({ position: 3, confidence: "low" }),
      row({ position: 4 }),
      row({ position: 5, skipped: true, assetTypeId: null }),
    ];
    const all = view(review(rows));
    expect(text(all)).toContain("5 rows · 4 included · 2 need attention");
    expect(all).toMatch(new RegExp(`href="/imports/${JOB}"[^>]*>All rows<`));
    expect(all).toMatch(new RegExp(`href="/imports/${JOB}\\?show=attention"[^>]*>Needs attention<`));
    expect(rowPositions(view(review(rows), { show: "attention" }))).toEqual([2, 3]);
  });

  test("C604: pages of 100 with Previous and Next, keeping the filter", () => {
    const rows = rowsAt(120);
    const one = view(review(rows));
    expect(rowPositions(one)).toHaveLength(100);
    expect(text(one)).toContain("Rows 1-100 of 120");
    expect(one).toContain(">Next<");
    expect(one).not.toContain(">Previous<");
    const two = view(review(rows), { page: "2" });
    expect(rowPositions(two)).toEqual(Array.from({ length: 20 }, (_, i) => 101 + i));
    expect(text(two)).toContain("Rows 101-120 of 120");
    expect(two).not.toContain(">Next<");
    expect(view(review(rowsAt(100)))).not.toMatch(/>(Next|Previous)</);
    const flagged = rowsAt(150).map((r) => ({ ...r, confidence: "low" as const }));
    expect(view(review(flagged), { show: "attention" })).toContain(`href="/imports/${JOB}?show=attention&amp;page=2"`);
  });

  test("C605: Needs attention with nothing flagged", () => {
    const html = view(review(rowsAt(3)), { show: "attention" });
    expect(text(html)).toContain("Every row is ready to add.");
    expect(rowPositions(html)).toEqual([]);
  });

  test("C606: no rows", () => {
    const html = view(review([]));
    expect(text(html)).toContain("No equipment was found in this file.");
    expect(html).not.toMatch(/Add \d+ asset/);
  });

  test("C608: a 2,000-row job counts every row", () => {
    expect(text(view(review(rowsAt(2000))))).toContain("2,000 rows");
  });

  test("C615: a skipped row is labelled and dimmed", () => {
    const html = view(review([row({ position: 1, skipped: true, assetTypeId: null, confidence: "low" }), row({ position: 2 })]));
    // The row's own grid carries the ink, not the column labels inside it.
    const gridOf = (position: number) => html.match(new RegExp(`data-row="${position}"[^>]*><div class="(grid [^"]*)"`))?.[1] ?? "";
    expect(gridOf(1).split(" ")).toContain("text-ink-2");
    expect(gridOf(2).split(" ")).toContain("text-ink");
    expect(gridOf(2).split(" ")).not.toContain("text-ink-2");
    expect(html).toMatch(/data-tone="neutral"[^>]*>Skipped</);
    expect(html).not.toContain(">Check this row<");
  });

  test.each<[string, Partial<ImportRowView>[], { assetTypeId: string; unitNo: string | null }[], string]>([
    ["C609", [{ position: 1, assetTypeId: null }], [], "Needs a type"],
    ["C610", [{ position: 1, unitNo: "u".repeat(41) }], [], "Too long: Unit #"],
    ["C610", [{ position: 1, typeModel: "m".repeat(121) }], [], "Too long: Type/model"],
    ["C610", [{ position: 1, location: "l".repeat(301) }], [], "Too long: Location/access"],
    ["C611", [{ position: 1, confidence: "low" }], [], "Check this row"],
    ["C612", [{ position: 1, unitNo: "RTU-1" }, { position: 2, unitNo: "rtu 1" }], [], "Same as row 1"],
    ["C613", [{ position: 1, unitNo: "RTU 2" }], [{ assetTypeId: RTU, unitNo: "rtu-2" }], "Already on this site"],
  ])("%s: the review view shows the flag pill %j", (_, rows, site, label) => {
    const html = view(review(rows.map((over) => row(over))), { site });
    expect(html).toMatch(new RegExp(`data-tone="attention"[^>]*>${label.replace(/[()#/]/g, "\\$&")}<`));
  });

  test("C620: each unrecognised spelling with its count and a type select, for a writer", () => {
    const rows = [row({ assetTypeId: null, assetTypeRaw: "Widget" }), row({ assetTypeId: null, assetTypeRaw: "widget" }), row({ assetTypeId: null, assetTypeRaw: "Gizmo" })];
    const html = view(review(rows));
    expect(text(html)).toContain("Widget · 2 rows");
    expect(text(html)).toContain("Gizmo · 1 row");
    expect(html).toMatch(/<select[^>]*id="map-0"/);
  });

  test("C623: Skip on an included row, Include on a skipped one", () => {
    const html = view(review([row({ position: 1 }), row({ position: 2, skipped: true })]));
    expect(html.match(/>Skip<\/button>/g)).toHaveLength(1);
    expect(html.match(/>Include<\/button>/g)).toHaveLength(1);
  });

  test("C624: an enabled commit button naming the count and site", () => {
    const three = view(review([row(), row({ confidence: "low" }), row({ unitNo: "RTU-1" })], "extracted"), { site: [{ assetTypeId: RTU, unitNo: "RTU-1" }] });
    expect(button(three, "Add 3 assets to Brookhaven")).toBeDefined();
    expect(button(three, "Add 3 assets to Brookhaven")).not.toContain('disabled=""');
    expect(button(view(review([row()])), "Add 1 asset to Brookhaven")).toBeDefined();
  });

  test.each<[string, ImportRowView[], string]>([
    ["2 untyped", [row({ assetTypeId: null }), row({ assetTypeId: null }), row()], "2 rows need a fix before they can be added"],
    ["1 too long", [row({ unitNo: "x".repeat(41) }), row()], "1 row needs a fix before it can be added"],
    ["1 untyped and 1 too long", [row({ assetTypeId: null }), row({ location: "x".repeat(301) })], "2 rows need a fix before they can be added"],
    ["none included", [row({ skipped: true })], "Include at least one row to add."],
  ])("C625: %s disables the commit button", (_, rows, line) => {
    const html = view(review(rows));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add \d+ assets? to Brookhaven</);
    expect(text(html)).toContain(line);
  });

  test("C632: a committed job's result line and the link to the site", () => {
    for (const [added, skipped, line] of [
      [336, 2, "Added to site: 336 assets, 2 skipped"],
      [3, 0, "Added to site: 3 assets"],
      [1, 0, "Added to site: 1 asset"],
    ] as const) {
      const html = view(review([row()], "committed", { added, skipped, at: new Date() }));
      expect(text(html)).toContain(line);
      expect(html).toMatch(new RegExp(`href="/sites/${SITE}"[^>]*>View Brookhaven<`));
    }
  });

  test("C634: a committed job is read-only, each row Added or Skipped", () => {
    const html = view(review([row({ assetId: "a1" }), row({ skipped: true })], "committed", { added: 1, skipped: 1, at: new Date() }));
    expect(html).toContain(">Added<");
    expect(html).toContain(">Skipped<");
    expect(html).not.toMatch(/>(Edit|Skip|Include|Apply)<\/button>|Add \d+ asset|id="map-/);
  });

  test("C634: a committed row is not flagged as already on the site it was added to", () => {
    const html = view(review([row({ unitNo: "RTU-1", assetId: "a1" })], "committed", { added: 1, skipped: 0, at: new Date() }), {
      site: [{ assetTypeId: RTU, unitNo: "RTU-1" }],
    });
    expect(html).toContain(">Added<");
    expect(html).not.toContain("Already on this site");
  });

  test("C638: a viewer sees the rows and flags and no control", () => {
    const html = view(review([row({ assetTypeId: null, assetTypeRaw: "Widget" }), row()]), { writer: false });
    expect(rowPositions(html)).toHaveLength(2);
    // The flag pill, not the equipment-type cell that also reads "Needs a type".
    expect(html).toMatch(/data-tone="attention"[^>]*>Needs a type</);
    expect(html).not.toMatch(/>(Edit|Skip|Include|Apply)<\/button>|Add \d+ asset|id="map-/);
  });
});

describe("review controls", () => {
  const editable = { id: "row-9", assetTypeId: RTU, unitNo: "RTU-9", typeModel: "Carrier", location: "Roof" };
  const editor = (state: RowState) => renderToStaticMarkup(createElement(RowEditor, { row: editable, types: TYPES, state, pending: false }));

  test("C616: the row editor shows the type select and fields with the row's values, Save and Cancel", () => {
    const html = editor({ status: "idle" });
    expect(html).toMatch(/<option value="type-rtu" selected="">Rooftop Unit \(RTU\)<\/option>/);
    expect(html).toContain(">Make-up Air Unit (MUA)<");
    expect(html).toMatch(/id="row-9-unitNo"[^>]*value="RTU-9"/);
    expect(html).toMatch(/id="row-9-typeModel"[^>]*value="Carrier"/);
    expect(html).toMatch(/id="row-9-location"[^>]*value="Roof"/);
    expect(html).toContain(">Save<");
    expect(html).toContain(">Cancel<");
  });

  test("C618: each field's error shows under that field", () => {
    const html = editor({ status: "invalid", errors: { assetTypeId: "Choose an equipment type", unitNo: "Unit # must be 40 characters or fewer" } });
    expect(html).toMatch(/id="row-9-assetTypeId-error"[^>]*>Choose an equipment type</);
    expect(html).toMatch(/id="row-9-unitNo-error"[^>]*>Unit # must be 40 characters or fewer</);
  });

  test("C621: a mapping reports how many rows it typed", () => {
    const map = (state: MapState) =>
      renderToStaticMarkup(createElement(MapPrompt, { spelling: { raw: "Widget", count: 14 }, types: TYPES, state, pending: false, index: 0 }));
    expect(text(map({ status: "mapped", rows: 14 }))).toContain("Applied to 14 rows");
  });

  const commit = (state: CommitState, confirming = false) =>
    renderToStaticMarkup(
      createElement(CommitPrompt, { label: "Add 3 assets to Brookhaven", siteName: "Brookhaven", added: 3, blocked: null, confirming, pending: false, state }),
    );

  test("C626: the commit asks before it adds anything", () => {
    const idle = commit({ status: "idle" });
    expect(idle).toContain(">Add 3 assets to Brookhaven<");
    expect(idle).not.toContain("Skipped rows stay on the import");
    expect(idle).not.toContain('type="submit"');
    const asking = commit({ status: "idle" }, true);
    expect(text(asking)).toContain("Add 3 assets to Brookhaven? Skipped rows stay on the import.");
    expect(asking).toMatch(/<button type="submit"[^>]*>Add assets<\/button>/);
    expect(asking).toMatch(/<button type="button"[^>]*>Cancel<\/button>/);
  });

  test("C628: a failed commit says to try again", () => {
    expect(commit({ status: "unavailable" })).toMatch(/role="alert"[^>]*>We couldn(&#x27;|')t add these assets\. Try again\.</);
  });

  test("C636: locked is said on the review and on the discard prompt", () => {
    expect(text(editor({ status: "locked" }))).toContain("This import was already added to the site.");
    const discard = renderToStaticMarkup(createElement(DiscardPrompt, { name: "units.xlsx", confirming: false, pending: false, state: { status: "locked" } }));
    expect(discard).toMatch(/role="alert"[^>]*>This import was already added to the site\.</);
  });

  test.each<[string, string]>([
    ["row unavailable", "We couldn't save this row. Try again."],
    ["locked", "This import was already added to the site."],
    ["forbidden", "You don't have permission to import equipment lists."],
    ["not_found", "This import no longer exists."],
    ["not_ready", "This import isn't ready to add yet."],
    ["nothing_to_add", "Include at least one row to add."],
  ])("C648: %s", (status, message) => {
    const html =
      status === "row unavailable"
        ? editor({ status: "unavailable" })
        : status === "not_ready" || status === "nothing_to_add"
          ? commit({ status } as CommitState)
          : editor({ status } as RowState);
    expect(text(html.match(/<p role="alert"[^>]*>[^<]*<\/p>/)?.[0] ?? "")).toContain(message);
  });
});
