import { createElement, type FunctionComponent, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AssetView, CustomerSummary, ImportHistoryRow, ImportJobView, ImportReview, SearchResults, SiteListRow, SiteView } from "@/application/ports";
import type { LibraryType } from "@/domain/task-library";
import { itemWords } from "@/domain/org-settings";
import { ItemWordsProvider } from "@/components/shell/item-words";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/sites" }));

const { SitesListView } = await import("./sites/sites-list");
const { SiteRegisterView } = await import("./sites/site-register-view");
const { SearchView } = await import("./search/search-view");
const { TaskLibraryView } = await import("./task-library/task-library-view");
const { AddTypeForm } = await import("./task-library/type-controls");
const { PipelineView } = await import("./kanban/pipeline-view");
const { ImportBanner } = await import("./imports/import-banner");
const { ImportUploadFields } = await import("./imports/import-upload");
const { ExtractPrompt } = await import("./imports/extract-control");
const { MappingSection, RowEditor } = await import("./imports/review-controls");
const { ImportJobList } = await import("./imports/job-list");
const { ImportHistoryView } = await import("./imports/import-history");
const { ImportPageView } = await import("./imports/import-page-view");
const { ReviewView } = await import("./imports/review-view");
const { NewAgreementDialog } = await import("./agreements/new-agreement-dialog");
const { SitesLoading, ImportLoading } = await import("./sites/loading-titles");

const stations = itemWords("station", "stations");
/** The output with the words set to station/stations, as a member of an org that chose them would get it. */
const asStations = (node: ReactElement) => renderToStaticMarkup(createElement(ItemWordsProvider as FunctionComponent<{ words: typeof stations }>, { words: stations }, node)).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const noEquipment = (html: string) => expect(html).not.toMatch(/equipment/i);

const customers: CustomerSummary[] = [{ id: "c1", name: "Harbourview Strata", primaryContact: null, active: true, siteCount: 1, assetCount: 0 }];
const siteRow = (patch: Partial<SiteListRow> = {}): SiteListRow => ({
  id: "s1", name: "Harbourview Towers", address: "2150 Harbour Lane", customerId: "c1", customer: "Harbourview Strata", active: true,
  assetCount: 3, equipment: [{ code: "RTU", count: 3 }], liveAgreement: null, ...patch,
});
const asset = (patch: Partial<AssetView> = {}): AssetView => ({
  id: "a1", typeCode: "BOILER", typeName: "Boiler", unitNo: "B-1", typeModel: null, location: null, source: "manual", active: true, replacedBy: null, ...patch,
});
const site = (assets: AssetView[]): SiteView => ({
  id: "s1", name: "Harbourview Towers", address: "2150 Harbour Lane", customerId: "c1", customerName: "Harbourview Strata", active: true,
  customerActive: true, siteContactId: "ct-1", contactName: "Dana Whitfield", assets, liveAgreement: null,
});
const job = (patch: Partial<ImportJobView> = {}): ImportJobView => ({
  id: "j1", originalName: "Units.xlsx", sizeBytes: 15_360, status: "extracted", uploadedBy: "dana@example.com", createdAt: new Date("2026-10-26T18:00:00Z"), outcome: null, extraction: null, committed: null,
  ...patch,
});

describe("staff screens, item words", () => {
  test("C2012: the Sites page names the item in its title, subtitle, note, column and empty cell", () => {
    const out = asStations(createElement(SitesListView, { rows: [siteRow({ equipment: [], assetCount: 0 }), siteRow({ id: "s2" })], customers, filter: {} }));
    for (const text of ["Sites &amp; stations", "the stations on it", "Stations, no agreement yet", "No stations"]) expect(out).toContain(text);
    expect(out).toContain(">Stations<");
    noEquipment(out);
    noEquipment(asStations(createElement(SitesListView, { rows: [], customers, filter: { q: "zzz" } })));
  });

  test("C2013: the site register names the item in its search, import button and empty and no-match states", () => {
    const view = (assets: AssetView[], query?: string) =>
      asStations(createElement(SiteRegisterView, { site: site(assets), role: "owner", initialQuery: query }));
    const empty = view([]);
    for (const text of ["No stations recorded yet", "Stations appear here once they are added or imported.", "Import station list"]) expect(empty).toContain(text);
    noEquipment(empty);
    const full = view([asset()]);
    expect(full).toContain("Search stations");
    noEquipment(full);
    const none = view([asset()], "zzz");
    expect(none).toContain('No stations match "zzz"');
    noEquipment(none);
  });

  test("C2014: the import flow names the item in the banner, upload, extract button, mapping, row editor, lists and review", () => {
    const actions = { start: vi.fn(), startImport: vi.fn(), confirmImport: vi.fn(), readImport: vi.fn(), extractImport: vi.fn() };
    const dialogProps = { customers: [], sites: [], actions } as unknown as Parameters<typeof ImportBanner>[0];
    const parts: string[] = [
      asStations(createElement(ImportBanner, dialogProps)),
      asStations(createElement(ImportUploadFields, { state: { status: "forbidden" }, fileName: null })),
      asStations(createElement(ExtractPrompt, { pending: false, progress: null, state: { status: "too_large" } })),
      asStations(createElement(MappingSection, { spellings: [{ key: "k", raw: "Pumper", count: 2 }], types: [], map: vi.fn() } as unknown as Parameters<typeof MappingSection>[0])),
      asStations(createElement(RowEditor, {
        row: { id: "r1", position: 1, assetTypeRaw: "x", assetTypeId: null, unitNo: "U", typeModel: null, location: null, confidence: "low", sourceRef: "s", skipped: false, assetId: null },
        types: [], state: { status: "invalid", errors: { assetTypeId: "Choose an equipment type" }, values: {} }, pending: false,
      } as unknown as Parameters<typeof RowEditor>[0])),
      asStations(createElement(ImportJobList, { jobs: [], words: stations })),
      asStations(createElement(ImportJobList, { jobs: [job({ extraction: { status: "extracted", rows: 4, unmatched: 2, cursor: 4, total: 4 } as never })], words: stations })),
      asStations(createElement(ImportHistoryView, { rows: [], sites: [], filter: {}, words: stations })),
      asStations(createElement(ImportPageView, { site: { id: "s1", name: "Harbourview Towers" }, jobs: [], agreementId: "00000000-0000-4000-8000-000000000001", actions: { start: vi.fn(), confirm: vi.fn(), discard: vi.fn(), read: vi.fn(), extract: vi.fn() } as never, words: stations })),
      asStations(createElement(ReviewView, {
        review: { job: { id: "j1", siteId: "s1", siteName: "Harbourview Towers", originalName: "Units.xlsx", status: "extracted", committed: null }, rows: [] } as unknown as ImportReview,
        types: [], siteAssets: [], show: "all", words: stations,
      })),
    ];
    const joined = parts.join("\n");
    for (const text of ["Drop a customer station list here", "Choose a station list", "import station lists", "Extract stations", "This document lists more stations than", "Station types not recognised", "Station type", "Choose a station type", "No station lists imported yet", "need a station type", "Station lists you upload", "Finish reading the station list", "Import station list", "No stations were found in this file."]) {
      expect(joined, text).toContain(text);
    }
    noEquipment(joined);
  });

  test("C2015: the New agreement dialog names the item in its intro and its file field", () => {
    const dialog = asStations(createElement(NewAgreementDialog, { customers: [], sites: [], actions: { start: vi.fn(), startImport: vi.fn(), confirmImport: vi.fn(), readImport: vi.fn(), extractImport: vi.fn() } } as unknown as Parameters<typeof NewAgreementDialog>[0]));
    expect(dialog).toContain("Start with the customer's station list");
    expect(dialog).toContain("Station list (optional)");
    noEquipment(dialog);
  });

  test("C2017: search names the item in its prompt, no-match line and group heading", () => {
    const none = { hits: [], more: false };
    const render = (query: string, results: SearchResults | null) => asStations(createElement(SearchView, { query, results, words: stations }));
    const prompt = render("", null);
    expect(prompt).toContain("Search customers, sites and stations by name");
    const miss = render("zzz", { customers: none, sites: none, equipment: none });
    expect(miss).toContain("No customers, sites or stations match “zzz”.");
    const hit = render("rtu", {
      customers: none, sites: none,
      equipment: { hits: [{ id: "a1", siteId: "s9", unitNo: "RTU-3", typeName: "Rooftop unit", siteName: "South Annex", customerName: "Pacific Mall" }], more: false },
    });
    expect(hit).toContain(">Stations<");
    for (const out of [prompt, miss, hit]) noEquipment(out);
  });

  test("C2018: the task library names the item in its empty state, nav label and new-type field", () => {
    const type: LibraryType = { id: "t-b", code: "BOILER", name: "Boiler", pack: "hvac", defaultVisitMonths: [10], tasks: [] };
    const action = async () => ({ status: "idle" as const });
    const empty = asStations(createElement(TaskLibraryView, { types: [], selected: null, role: "owner", action, words: stations }));
    expect(empty).toContain("No station types yet");
    expect(empty).toContain("The station types and checklists of your company appear here.");
    const listed = asStations(createElement(TaskLibraryView, { types: [type], selected: type, role: "viewer", action, words: stations }));
    expect(listed).toContain('aria-label="Station types"');
    const add = asStations(createElement(AddTypeForm, { action: async () => ({ status: "idle" as const }) }));
    expect(add).toContain("New station type");
    for (const out of [empty, listed, add]) noEquipment(out);
  });

  test("C2019: the Pipeline subtitle and its recent imports block name the item", () => {
    const imports: ImportHistoryRow[] = [{ ...job(), site: { id: "s1", name: "Harbourview Towers" }, customer: { id: "c1", name: "Harbourview Strata" } }];
    const out = asStations(createElement(PipelineView, { cards: [], imports }));
    expect(out).toContain("from station list to signature");
    expect(out).toContain("Recent station imports");
    noEquipment(out);
  });

  test("C2020: the loading skeletons of Sites and the import page are titled with the item", () => {
    expect(asStations(createElement(SitesLoading))).toContain("Sites &amp; stations");
    expect(asStations(createElement(ImportLoading))).toContain("Import station list");
    expect(renderToStaticMarkup(createElement(SitesLoading))).toContain("Sites &amp; equipment");
    expect(renderToStaticMarkup(createElement(ImportLoading))).toContain("Import equipment list");
  });
});
