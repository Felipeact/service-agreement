import { afterEach, describe, expect, test, vi } from "vitest";
import { fixedClock } from "@/infrastructure/clock";
import type { ImportRowInput } from "@/application/ports";
import { supabaseImportJobReader, supabaseImportJobStore } from "./imports";
import { stubClient, type Reply } from "./stub-client";

const ORG = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const KEY = `${ORG}/${JOB}`;
const AT = new Date("2026-10-26T12:00:00Z");
const CSV = "text/csv";

const ok = (data: unknown): Reply => ({ data, error: null });
const jobRow = (status: string, patch: Record<string, unknown> = {}) => ({
  id: JOB,
  org_id: ORG,
  status,
  content_type: CSV,
  read_error: null,
  table_count: 1,
  row_count: 48,
  extract_cursor: null,
  extract_total: null,
  ...patch,
});
const blob = (bytes: number[]) => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer });

function setup(tables: Parameters<typeof stubClient>[0], storage: Parameters<typeof stubClient>[1] = {}) {
  const stub = stubClient(tables, storage);
  return { ...stub, store: supabaseImportJobStore(stub.typed, fixedClock(AT)), reader: supabaseImportJobReader(stub.typed) };
}

const downloads = (calls: { table: string; method: string; args: unknown[] }[]) => calls.filter((c) => c.table === "storage:imports" && c.method === "download");

afterEach(() => vi.restoreAllMocks());

describe("ImportJobStore.sourceOf", () => {
  test.each<[string, boolean, Record<string, unknown>]>([
    ["uploading", false, {}],
    ["uploaded", false, {}],
    ["parsed", true, {}],
    ["unreadable", false, { read_error: "corrupt" }],
    ["extracting", true, { extract_cursor: 2, extract_total: 4 }],
    ["extracted", false, { extract_cursor: 4, extract_total: 4 }],
  ])("C527: a %s job downloads the file: %s", async (status, downloaded, patch) => {
    const { store, calls } = setup(
      { import_jobs: ok(jobRow(status, patch)), import_row_counts: ok([{ rows: 338, unmatched: 14 }]) },
      { download: { data: blob([7, 8, 9]), error: null } },
    );

    const result = await store.sourceOf(JOB);

    expect(result.ok).toBe(true);
    expect(downloads(calls)).toHaveLength(downloaded ? 1 : 0);
    if (downloaded) {
      expect(downloads(calls)[0].args).toEqual([KEY]);
      expect(result).toMatchObject({ bytes: new Uint8Array([7, 8, 9]) });
    } else {
      expect(result).toMatchObject({ bytes: null });
    }
  });

  test("C527: progress is null for a parsed job and the stored cursor and total for an extracting one", async () => {
    const parsed = setup({ import_jobs: ok(jobRow("parsed")) }, { download: { data: blob([1]), error: null } });
    expect(await parsed.store.sourceOf(JOB)).toMatchObject({ status: "parsed", progress: null, result: null, contentType: CSV });

    const extracting = setup({ import_jobs: ok(jobRow("extracting", { extract_cursor: 2, extract_total: 4 })) }, { download: { data: blob([1]), error: null } });
    expect(await extracting.store.sourceOf(JOB)).toMatchObject({ status: "extracting", progress: { cursor: 2, total: 4 } });
  });

  test("C527: fileOf on a parsed job still returns its outcome and never downloads", async () => {
    const { store, calls } = setup({ import_jobs: ok(jobRow("parsed")) });

    expect(await store.fileOf(JOB)).toEqual({ ok: true, status: "parsed", contentType: CSV, outcome: { status: "parsed", tables: 1, rows: 48 }, bytes: null });
    expect(downloads(calls)).toHaveLength(0);
  });

  test("C521: an extracted job returns the counts of its import_row_counts row and no bytes", async () => {
    const { store, calls } = setup({ import_jobs: ok(jobRow("extracted", { extract_cursor: 4, extract_total: 4 })), import_row_counts: ok([{ rows: 338, unmatched: 14 }]) });

    expect(await store.sourceOf(JOB)).toMatchObject({ ok: true, status: "extracted", result: { rows: 338, unmatched: 14 }, bytes: null });
    expect(calls.filter((c) => c.table === "import_row_counts" && c.method === "eq").map((c) => c.args)).toEqual([["job_id", JOB]]);
  });

  test("C521: a job that is not extracted has no result", async () => {
    const { store } = setup({ import_jobs: ok(jobRow("extracting", { extract_cursor: 1, extract_total: 2 })) }, { download: { data: blob([1]), error: null } });

    expect(await store.sourceOf(JOB)).toMatchObject({ result: null });
  });

  test("C535: a job the select returns no row for is not_found, with no download", async () => {
    const { store, calls } = setup({ import_jobs: ok(null) });

    expect(await store.sourceOf(JOB)).toEqual({ ok: false, code: "not_found" });
    expect(downloads(calls)).toHaveLength(0);
  });

  test("C529: a failed download is unavailable and logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store } = setup({ import_jobs: ok(jobRow("parsed")) }, { download: { data: null, error: { message: "storage down" } } });

    expect(await store.sourceOf(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
  });
});

const row: ImportRowInput = { assetTypeRaw: "RTU", unitNo: "1", typeModel: null, location: null, confidence: "high", sourceRef: "Units!2", assetTypeId: "t-1" };

describe("ImportJobStore.recordExtraction", () => {
  test.each<[string, Reply | { data: null; error: { code: string; message: string } }, unknown]>([
    ["rpc returns 3 for cursor 2", ok(3), { ok: true, progress: { cursor: 3, total: 4 }, done: false }],
    ["rpc returns 4 for cursor 3", ok(4), { ok: true, progress: { cursor: 4, total: 4 }, done: true }],
  ])("C524: %s", async (name, reply, expected) => {
    const { client, store } = setup({});
    client.rpc.mockResolvedValue(reply);

    const cursor = name.includes("cursor 2") ? 2 : 3;
    expect(await store.recordExtraction(JOB, cursor, 4, [row])).toEqual(expected);
  });

  test("C524: the rpc is called with p_job_id, p_expected_cursor, p_total and the rows as snake_case json", async () => {
    const { client, store } = setup({});
    client.rpc.mockResolvedValue(ok(1));

    await store.recordExtraction(JOB, null, 4, [row]);

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("record_extraction_chunk", {
      p_job_id: JOB,
      p_expected_cursor: null,
      p_total: 4,
      p_rows: [{ asset_type_raw: "RTU", unit_no: "1", type_model: null, location: null, confidence: "high", source_ref: "Units!2", asset_type_id: "t-1" }],
    });
  });

  test.each<[string, string, Record<string, unknown>, unknown]>([
    ["extracting 3/4", "40001", { status: "extracting", extract_cursor: 3, extract_total: 4 }, { ok: true, progress: { cursor: 3, total: 4 }, done: false }],
    ["extracted 4/4", "40001", { status: "extracted", extract_cursor: 4, extract_total: 4 }, { ok: true, progress: { cursor: 4, total: 4 }, done: true }],
  ])("C524: a stale cursor with the job %s returns the stored progress and sends no rows again", async (_name, code, stored, expected) => {
    const { client, store, calls } = setup({ import_jobs: ok(stored) });
    client.rpc.mockResolvedValue({ data: null, error: { code, message: "stale" } });

    expect(await store.recordExtraction(JOB, 2, 4, [row])).toEqual(expected);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.table === "import_jobs" && c.method === "select")).toHaveLength(1);
  });

  test.each<[string, string, unknown, number]>([
    ["P0002", "P0002", { ok: false, code: "not_found" }, 0],
    ["42501", "42501", { ok: false, code: "forbidden" }, 0],
    ["XX000", "XX000", { ok: false, code: "unavailable" }, 1],
  ])("C524: error %s maps to its code", async (_name, code, expected, logged) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, store } = setup({});
    client.rpc.mockResolvedValue({ data: null, error: { code, message: "boom" } });

    expect(await store.recordExtraction(JOB, null, 4, [row])).toEqual(expected);
    expect(log).toHaveBeenCalledTimes(logged);
  });
});

describe("ImportJobReader.forSite extraction", () => {
  test("C545: selects the cursor and total, reads counts from import_row_counts, and maps each status", async () => {
    const base = { created_by_email: "dana@example.com", created_at: "2026-10-26T18:00:00Z", size_bytes: 100, read_error: null, table_count: 1, row_count: 48 };
    const jobs = [
      { ...base, id: "j-ex", original_name: "a.csv", status: "extracted", extract_cursor: 4, extract_total: 4 },
      { ...base, id: "j-ing", original_name: "b.csv", status: "extracting", extract_cursor: 2, extract_total: 4 },
      { ...base, id: "j-p", original_name: "c.csv", status: "parsed", extract_cursor: null, extract_total: null },
      { ...base, id: "j-u", original_name: "d.csv", status: "uploaded", table_count: null, row_count: null, extract_cursor: null, extract_total: null },
    ];
    const { reader, calls } = setup({ import_jobs: ok(jobs), import_row_counts: ok([{ job_id: "j-ex", rows: 338, unmatched: 14 }]) });

    const views = await reader.forSite(SITE);

    expect(views.map((v) => v.extraction)).toEqual([
      { status: "extracted", rows: 338, unmatched: 14 },
      { status: "extracting", cursor: 2, total: 4 },
      null,
      null,
    ]);
    const select = calls.find((c) => c.table === "import_jobs" && c.method === "select")?.args[0] as string;
    expect(select).toContain("extract_cursor");
    expect(select).toContain("extract_total");
    expect(calls.find((c) => c.table === "import_row_counts" && c.method === "in")?.args).toEqual(["job_id", ["j-ex"]]);
  });
});
