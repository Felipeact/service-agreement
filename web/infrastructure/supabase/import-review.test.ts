import { afterEach, describe, expect, test, vi } from "vitest";
import { fixedClock } from "@/infrastructure/clock";
import { supabaseImportReviewReader, supabaseImportRowStore } from "./import-review";
import { supabaseImportJobReader, supabaseImportJobStore } from "./imports";
import { stubClient, type Reply } from "./stub-client";

const JOB = "33333333-3333-4333-8333-333333333333";
const ROW = "44444444-4444-4444-8444-444444444444";
const SITE = "22222222-2222-4222-8222-222222222222";
const TYPE = "55555555-5555-4555-8555-555555555555";

const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (code: string): Reply => ({ data: null, error: { code, message: `error ${code}` } });

const jobRow = (status: string, patch: Record<string, unknown> = {}) => ({
  id: JOB,
  site_id: SITE,
  original_name: "units.xlsx",
  status,
  committed_at: null,
  committed_count: null,
  sites: { name: "Brookhaven" },
  ...patch,
});

const importRow = (position: number, patch: Record<string, unknown> = {}) => ({
  id: `row-${position}`,
  position,
  asset_type_raw: "Rooftop unit",
  asset_type_id: TYPE,
  unit_no: `RTU-${position}`,
  type_model: null,
  location: null,
  confidence: "high",
  source_ref: `Units!${position + 1}`,
  skipped: false,
  asset_id: null,
  ...patch,
});

const rowsOf = (n: number, start = 1) => Array.from({ length: n }, (_, i) => importRow(start + i));

afterEach(() => vi.restoreAllMocks());

describe("ImportReviewReader.forJob", () => {
  test("C607: a malformed id reads nothing; a missing job is null", async () => {
    const { typed, calls } = stubClient({ import_jobs: ok(null) });
    const reader = supabaseImportReviewReader(typed);
    expect(await reader.forJob("not-a-uuid")).toBeNull();
    expect(calls).toHaveLength(0);
    expect(await reader.forJob(JOB)).toBeNull();
    expect(calls.some((c) => c.table === "import_rows")).toBe(false);
  });

  test.each(["uploading", "uploaded", "parsed", "unreadable", "extracting"])("C607: a %s job is null and no row is read", async (status) => {
    const { typed, calls } = stubClient({ import_jobs: ok([jobRow(status)]), import_rows: ok(rowsOf(2)) });
    expect(await supabaseImportReviewReader(typed).forJob(JOB)).toBeNull();
    expect(calls.some((c) => c.table === "import_rows")).toBe(false);
  });

  test.each([
    [0, 1],
    [999, 1],
    [1000, 2],
    [2000, 3],
  ])("C608: %i rows are read in %i pages of 1,000, in position order", async (total, pages) => {
    const all = rowsOf(total);
    const sequence = Array.from({ length: pages }, (_, i) => ok(all.slice(i * 1000, (i + 1) * 1000)));
    const { typed, calls } = stubClient({ import_jobs: ok([jobRow("extracted")]), import_rows: { sequence } });

    const review = await supabaseImportReviewReader(typed).forJob(JOB);

    expect(review?.rows).toHaveLength(total);
    const ranges = calls.filter((c) => c.table === "import_rows" && c.method === "range").map((c) => c.args);
    expect(ranges).toEqual(Array.from({ length: pages }, (_, i) => [i * 1000, i * 1000 + 999]));
    expect(calls.find((c) => c.table === "import_rows" && c.method === "order")?.args).toEqual(["position", { ascending: true }]);
  });

  test("C608: maps the job, its site and each row", async () => {
    const { typed } = stubClient({
      import_jobs: ok([jobRow("committed", { committed_at: "2026-10-27T18:00:00Z", committed_count: 1 })]),
      import_rows: ok([importRow(1, { asset_id: "a-1" }), importRow(2, { skipped: true, asset_type_id: null })]),
    });
    const review = await supabaseImportReviewReader(typed).forJob(JOB);
    expect(review?.job).toEqual({
      id: JOB,
      siteId: SITE,
      siteName: "Brookhaven",
      originalName: "units.xlsx",
      status: "committed",
      committed: { added: 1, skipped: 1, at: new Date("2026-10-27T18:00:00Z") },
    });
    expect(review?.rows[0]).toEqual({
      id: "row-1",
      position: 1,
      assetTypeRaw: "Rooftop unit",
      assetTypeId: TYPE,
      unitNo: "RTU-1",
      typeModel: null,
      location: null,
      confidence: "high",
      sourceRef: "Units!2",
      skipped: false,
      assetId: "a-1",
    });
  });
});

describe("ImportRowStore", () => {
  test("C619: each write sends only the columns it owns", async () => {
    const { typed, calls } = stubClient({ import_rows: ok([{ id: ROW }]) });
    const store = supabaseImportRowStore(typed);
    await store.update(ROW, { assetTypeId: TYPE, unitNo: "RTU-1", typeModel: "Carrier", location: null });
    await store.setSkipped(ROW, true);
    await store.mapType(JOB, "widget", TYPE);

    const updates = calls.filter((c) => c.method === "update").map((c) => Object.keys(c.args[0] as object).sort());
    expect(updates[0]).toEqual(["asset_type_id", "location", "type_model", "unit_no"]);
    expect(updates[1]).toEqual(["skipped"]);
    for (const keys of updates) {
      for (const owned of ["asset_type_raw", "confidence", "source_ref", "position", "asset_id", "job_id"]) expect(keys).not.toContain(owned);
    }
    expect(calls.filter((c) => c.method === "update")[0].args[0]).toEqual({ asset_type_id: TYPE, unit_no: "RTU-1", type_model: "Carrier", location: null });
  });

  test("C622: mapType types only the job's untyped rows with that spelling, still untyped at the update", async () => {
    const untyped = [
      { id: "w1", asset_type_raw: "Widget" },
      { id: "w2", asset_type_raw: " widget" },
      { id: "x1", asset_type_raw: "Gizmo" },
      { id: "w3", asset_type_raw: "WIDGET" },
      { id: "n1", asset_type_raw: null },
    ];
    const { typed, calls } = stubClient({ import_rows: { sequence: [ok(untyped), ok([{ id: "w1" }, { id: "w2" }, { id: "w3" }])] } });

    const result = await supabaseImportRowStore(typed).mapType(JOB, "widget", TYPE);

    expect(result).toEqual({ ok: true, rows: 3 });
    const read = calls.filter((c) => c.method === "is");
    expect(read[0].args).toEqual(["asset_type_id", null]);
    expect(calls.find((c) => c.method === "eq")?.args).toEqual(["job_id", JOB]);
    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({ asset_type_id: TYPE });
    expect(calls.find((c) => c.method === "in")?.args).toEqual(["id", ["w1", "w2", "w3"]]);
    expect(read[1].args).toEqual(["asset_type_id", null]);
  });

  test.each(["update", "setSkipped", "mapType"] as const)("C636: %s maps SQLSTATE 55000 to locked", async (method) => {
    const reply = fail("55000");
    const { typed } = stubClient({ import_rows: method === "mapType" ? { sequence: [ok([{ id: "w1", asset_type_raw: "Widget" }]), reply] } : reply });
    const store = supabaseImportRowStore(typed);
    const result =
      method === "update"
        ? await store.update(ROW, { assetTypeId: TYPE, unitNo: null, typeModel: null, location: null })
        : method === "setSkipped"
          ? await store.setSkipped(ROW, true)
          : await store.mapType(JOB, "widget", TYPE);
    expect(result).toEqual({ ok: false, code: "locked" });
  });

  test("C640: update and setSkipped answer not_found when no row comes back", async () => {
    const { typed } = stubClient({ import_rows: ok([]) });
    const store = supabaseImportRowStore(typed);
    expect(await store.update(ROW, { assetTypeId: TYPE, unitNo: null, typeModel: null, location: null })).toEqual({ ok: false, code: "not_found" });
    expect(await store.setSkipped(ROW, false)).toEqual({ ok: false, code: "not_found" });
  });

  test("C640: mapType answers not_found when its update names a job's row RLS no longer shows", async () => {
    const { typed } = stubClient({ import_rows: { sequence: [ok([{ id: "w1", asset_type_raw: "Widget" }]), fail("23503")] } });
    expect(await supabaseImportRowStore(typed).mapType(JOB, "widget", TYPE)).toEqual({ ok: false, code: "not_found" });
  });
});

describe("ImportJobStore.commit", () => {
  function setup(rpc: Reply, job: unknown, rows = 3) {
    const stub = stubClient({ import_jobs: ok(job), import_row_counts: ok([{ rows }]) });
    stub.client.rpc.mockResolvedValue(rpc);
    return { ...stub, store: supabaseImportJobStore(stub.typed, fixedClock(new Date())) };
  }
  const committed = { status: "committed", committed_count: 2 };

  test.each<[string, Reply, unknown, unknown]>([
    ["ok", ok(2), committed, { ok: true, added: 2, skipped: 1 }],
    ["40001 committed", fail("40001"), committed, { ok: true, added: 2, skipped: 1 }],
    ["40001 extracting", fail("40001"), { status: "extracting", committed_count: null }, { ok: false, code: "not_ready" }],
    ["23514", fail("23514"), committed, { ok: false, code: "incomplete" }],
    ["P0002", fail("P0002"), committed, { ok: false, code: "not_found" }],
    ["42501", fail("42501"), committed, { ok: false, code: "forbidden" }],
  ])("C646: %s", async (_, rpc, job, expected) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, client } = setup(rpc, job);
    expect(await store.commit(JOB)).toEqual(expected);
    expect(client.rpc).toHaveBeenCalledWith("commit_import", { p_job_id: JOB });
    expect(errors).not.toHaveBeenCalled();
  });

  test("C628: any other error is unavailable and logged once", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store } = setup(fail("XX000"), committed);
    expect(await store.commit(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(errors).toHaveBeenCalledTimes(1);
  });

  test("C631: a repeat after the commit answers with the first call's result", async () => {
    const { store } = setup(fail("40001"), committed, 3);
    expect(await store.commit(JOB)).toEqual({ ok: true, added: 2, skipped: 1 });
  });
});

describe("ImportJobStore.discard and the job list", () => {
  test("C636: a committed job is not deleted and answers locked", async () => {
    const { typed, calls } = stubClient({ import_jobs: { sequence: [ok([]), ok([{ id: JOB, org_id: "o", size_bytes: 1, status: "committed" }])] } });
    const store = supabaseImportJobStore(typed, fixedClock(new Date()));
    expect(await store.discard(JOB)).toEqual({ ok: false, code: "locked" });
    expect(calls.find((c) => c.method === "neq")?.args).toEqual(["status", "committed"]);
    expect(calls.some((c) => c.table === "storage:imports")).toBe(false);
  });

  test("C635: forSite maps a committed job to what it added and skipped", async () => {
    const base = { created_by_email: null, created_at: "2026-10-27T18:00:00Z", size_bytes: 100, read_error: null, table_count: 1, row_count: 338 };
    const { typed } = stubClient({
      import_jobs: ok([{ ...base, id: "j-c", original_name: "a.csv", status: "committed", extract_cursor: 4, extract_total: 4, committed_count: 336 }]),
      import_row_counts: ok([{ job_id: "j-c", rows: 338, unmatched: 0 }]),
    });
    const [view] = await supabaseImportJobReader(typed).forSite(SITE);
    expect(view.committed).toEqual({ added: 336, skipped: 2 });
    expect(view.outcome).toEqual({ status: "parsed", tables: 1, rows: 338 });
  });
});
