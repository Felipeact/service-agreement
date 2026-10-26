import { afterEach, describe, expect, test, vi } from "vitest";
import { fixedClock } from "@/infrastructure/clock";
import type { ImportFile } from "@/domain/imports";
import { supabaseImportJobReader, supabaseImportJobStore } from "./imports";
import { stubClient, type Reply, type Sequence, type StorageReply } from "./stub-client";

const ORG = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const KEY = `${ORG}/${JOB}`;
const SIGNED = `https://example.supabase.co/storage/v1/object/upload/sign/imports/${KEY}?token=t`;
const AT = new Date("2026-10-26T12:00:00Z");
const FILE: ImportFile = { name: "Units.xlsx", size: 2048, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (code: string, message = "boom"): Reply => ({ data: null, error: { code, message } });
const jobRow = (status: string, size = 2048) => ({ id: JOB, org_id: ORG, size_bytes: size, status });

function store(jobs: Reply | Sequence, storage: Record<string, StorageReply | (() => never)> = {}) {
  const stub = stubClient({ import_jobs: jobs }, storage);
  return { ...stub, store: supabaseImportJobStore(stub.typed, fixedClock(AT)) };
}

const storageCalls = (calls: { table: string; method: string; args: unknown[] }[]) => calls.filter((call) => call.table === "storage:imports");
const jobCalls = (calls: { table: string; method: string; args: unknown[] }[], method: string) =>
  calls.filter((call) => call.table === "import_jobs" && call.method === method);

afterEach(() => vi.restoreAllMocks());

describe("ImportJobStore.start", () => {
  test("C404: inserts the uploading job, then signs an upload URL for <orgId>/<jobId> with no upsert", async () => {
    const { store: s, calls } = store(ok([{ id: JOB }]), { createSignedUploadUrl: { data: { signedUrl: SIGNED, token: "t", path: KEY }, error: null } });

    const result = await s.start(ORG, SITE, FILE);

    expect(result).toEqual({ ok: true, jobId: JOB, signedUrl: SIGNED, contentType: FILE.contentType });
    const [insert] = jobCalls(calls, "insert");
    expect(insert.args).toEqual([
      { org_id: ORG, site_id: SITE, original_name: "Units.xlsx", size_bytes: 2048, content_type: FILE.contentType, status: "uploading" },
    ]);
    expect(jobCalls(calls, "select")[0].args).toEqual(["id"]);
    const signs = storageCalls(calls);
    expect(signs).toEqual([{ table: "storage:imports", method: "createSignedUploadUrl", args: [KEY] }]);
    // Insert before sign: the signed key names a job that exists.
    expect(calls.findIndex((call) => call.method === "insert")).toBeLessThan(calls.findIndex((call) => call.method === "createSignedUploadUrl"));
  });

  test.each([
    ["insert 42501", fail("42501"), {}, "forbidden", false],
    ["insert 23503", fail("23503"), {}, "not_found", false],
    ["any other database error", fail("XX000"), {}, "unavailable", true],
    ["a createSignedUploadUrl error", ok([{ id: JOB }]), { createSignedUploadUrl: { data: null, error: { message: "storage down" } } }, "unavailable", true],
  ] as [string, Reply, Record<string, StorageReply>, string, boolean][])("C431: %s -> %s", async (_name, reply, storage, code, logged) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store: s } = store(reply, storage);

    expect(await s.start(ORG, SITE, FILE)).toEqual({ ok: false, code });
    expect(log.mock.calls.length > 0).toBe(logged);
    if (logged) expect(String(log.mock.calls[0][0])).toMatch(/XX000|storage down/);
  });

  test("C431: an info error on confirm -> unavailable, logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store: s, calls } = store(ok([jobRow("uploading")]), { info: { data: null, error: { message: "gateway timeout", status: 504 } } });

    expect(await s.confirmUploaded(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(jobCalls(calls, "update")).toHaveLength(0);
    expect(String(log.mock.calls[0][0])).toContain("gateway timeout");
  });
});

describe("ImportJobStore.confirmUploaded", () => {
  test("C406: same size -> compare-and-set uploading to uploaded on that id", async () => {
    const { store: s, calls } = store({ sequence: [ok([jobRow("uploading")]), ok([{ id: JOB }])] }, { info: { data: { size: 2048 }, error: null } });

    expect(await s.confirmUploaded(JOB)).toEqual({ ok: true });

    expect(storageCalls(calls)).toEqual([{ table: "storage:imports", method: "info", args: [KEY] }]);
    const [update] = jobCalls(calls, "update");
    expect(update.args[0]).toMatchObject({ status: "uploaded" });
    const filters = jobCalls(calls, "eq").map((call) => call.args);
    expect(filters).toContainEqual(["id", JOB]);
    expect(filters).toContainEqual(["status", "uploading"]);
  });

  test.each([
    ["the object is missing (404)", { data: null, error: { message: "Object not found", status: 400, statusCode: "404" } }],
    ["the size differs by 1", { data: { size: 2049 }, error: null }],
  ] as [string, StorageReply][])("C415: %s -> upload_missing, no update", async (_name, info) => {
    const { store: s, calls } = store(ok([jobRow("uploading")]), { info });

    expect(await s.confirmUploaded(JOB)).toEqual({ ok: false, code: "upload_missing" });
    expect(jobCalls(calls, "update")).toHaveLength(0);
  });

  test("C417: the compare-and-set matches no row and the job reads uploaded -> ok, nothing else written", async () => {
    const { store: s, calls } = store({ sequence: [ok([jobRow("uploading")]), ok([]), ok([jobRow("uploaded")])] }, { info: { data: { size: 2048 }, error: null } });

    expect(await s.confirmUploaded(JOB)).toEqual({ ok: true });
    expect(jobCalls(calls, "update")).toHaveLength(1);
    expect(jobCalls(calls, "insert")).toHaveLength(0);
    expect(jobCalls(calls, "delete")).toHaveLength(0);
  });

  test("C417: a job already uploaded -> ok with no write and no storage call", async () => {
    const { store: s, calls } = store(ok([jobRow("uploaded")]));

    expect(await s.confirmUploaded(JOB)).toEqual({ ok: true });
    expect(jobCalls(calls, "update")).toHaveLength(0);
    expect(storageCalls(calls)).toHaveLength(0);
  });

  test("C427: the compare-and-set matches no row and the job is gone -> not_found", async () => {
    const { store: s } = store({ sequence: [ok([jobRow("uploading")]), ok([]), ok(null)] }, { info: { data: { size: 2048 }, error: null } });

    expect(await s.confirmUploaded(JOB)).toEqual({ ok: false, code: "not_found" });
  });

  test("C427: a job that is not readable -> not_found", async () => {
    const { store: s, calls } = store(ok(null));

    expect(await s.confirmUploaded(JOB)).toEqual({ ok: false, code: "not_found" });
    expect(jobCalls(calls, "update")).toHaveLength(0);
  });
});

describe("ImportJobStore.discard", () => {
  test("C421: deletes the row by id, then removes <orgId>/<jobId>", async () => {
    const { store: s, calls } = store(ok([{ id: JOB, org_id: ORG }]), { remove: { data: [], error: null } });

    expect(await s.discard(JOB)).toEqual({ ok: true });

    expect(jobCalls(calls, "eq")[0].args).toEqual(["id", JOB]);
    expect(jobCalls(calls, "select")[0].args).toEqual(["id, org_id"]);
    expect(storageCalls(calls)).toEqual([{ table: "storage:imports", method: "remove", args: [[KEY]] }]);
    expect(calls.findIndex((call) => call.method === "delete")).toBeLessThan(calls.findIndex((call) => call.method === "remove"));
  });

  test("C422: the object delete fails after the row is gone -> still ok, the key is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store: s } = store(ok([{ id: JOB, org_id: ORG }]), { remove: { data: null, error: { message: "storage down" } } });

    expect(await s.discard(JOB)).toEqual({ ok: true });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain(KEY);
  });

  test("C427: the delete matches no row -> not_found, no storage call", async () => {
    const { store: s, calls } = store(ok([]));

    expect(await s.discard(JOB)).toEqual({ ok: false, code: "not_found" });
    expect(storageCalls(calls)).toHaveLength(0);
  });
});

describe("ImportJobReader.forSite", () => {
  test("C410: one site's jobs, newest first, capped at 500", async () => {
    const stub = stubClient({
      import_jobs: ok([
        { id: "j2", original_name: "b.pdf", size_bytes: 10, status: "uploaded", created_by_email: "a@example.com", created_at: "2026-10-26T10:00:00Z" },
        { id: "j1", original_name: "a.csv", size_bytes: 5, status: "uploading", created_by_email: null, created_at: "2026-10-25T10:00:00Z" },
      ]),
    });

    const jobs = await supabaseImportJobReader(stub.typed).forSite(SITE);

    expect(jobs.map((job) => job.id)).toEqual(["j2", "j1"]);
    expect(jobs[1]).toEqual({ id: "j1", originalName: "a.csv", sizeBytes: 5, status: "uploading", uploadedBy: null, createdAt: new Date("2026-10-25T10:00:00Z"), outcome: null });
    const methods = stub.calls.map((call) => [call.method, call.args]);
    expect(methods).toContainEqual(["eq", ["site_id", SITE]]);
    expect(methods).toContainEqual(["order", ["created_at", { ascending: false }]]);
    expect(methods).toContainEqual(["limit", [500]]);
  });
});

const CSV = "text/csv";
const readRow = (status: string, patch: Record<string, unknown> = {}) => ({
  id: JOB,
  org_id: ORG,
  status,
  content_type: CSV,
  read_error: null,
  table_count: null,
  row_count: null,
  ...patch,
});
const blob = (bytes: number[]) => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer });

describe("ImportJobStore.fileOf", () => {
  test("C465: an uploaded job downloads <orgId>/<jobId> once and returns its bytes", async () => {
    const { store: s, calls } = store(ok(readRow("uploaded")), { download: { data: blob([7, 8, 9]), error: null } });

    const result = await s.fileOf(JOB);

    expect(result).toEqual({ ok: true, status: "uploaded", contentType: CSV, outcome: null, bytes: new Uint8Array([7, 8, 9]) });
    expect(storageCalls(calls)).toEqual([{ table: "storage:imports", method: "download", args: [KEY] }]);
  });

  test("C465: a parsed job returns its stored outcome and never downloads", async () => {
    const { store: s, calls } = store(ok(readRow("parsed", { table_count: 1, row_count: 48 })));

    expect(await s.fileOf(JOB)).toEqual({ ok: true, status: "parsed", contentType: CSV, outcome: { status: "parsed", tables: 1, rows: 48 }, bytes: null });
    expect(storageCalls(calls)).toEqual([]);
  });

  test("C481: a job the select returns no row for is not_found, with no download", async () => {
    const { store: s, calls } = store(ok(null));

    expect(await s.fileOf(JOB)).toEqual({ ok: false, code: "not_found" });
    expect(storageCalls(calls)).toEqual([]);
  });

  test("C477: a failed download is unavailable and logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store: s } = store(ok(readRow("uploaded")), { download: { data: null, error: { message: "storage down" } } });

    expect(await s.fileOf(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("ImportJobStore.recordRead", () => {
  test("C464: parsed writes the counts, clears the reason and stamps read_at, only while uploaded", async () => {
    const { store: s, calls } = store(ok([{ id: JOB }]));

    const outcome = { status: "parsed", tables: 1, rows: 48 } as const;
    expect(await s.recordRead(JOB, outcome)).toEqual({ ok: true, outcome });

    const [update] = jobCalls(calls, "update");
    expect(update.args).toEqual([
      { status: "parsed", table_count: 1, row_count: 48, read_error: null, read_at: AT.toISOString(), updated_at: AT.toISOString() },
    ]);
    const filters = jobCalls(calls, "eq").map((call) => call.args);
    expect(filters).toEqual([
      ["id", JOB],
      ["status", "uploaded"],
    ]);
    expect(jobCalls(calls, "select")).toHaveLength(1);
  });

  test("C464: unreadable writes the reason and no counts", async () => {
    const { store: s, calls } = store(ok([{ id: JOB }]));

    const outcome = { status: "unreadable", reason: "no_table" } as const;
    expect(await s.recordRead(JOB, outcome)).toEqual({ ok: true, outcome });
    expect(jobCalls(calls, "update")[0].args).toEqual([
      { status: "unreadable", read_error: "no_table", table_count: null, row_count: null, read_at: AT.toISOString(), updated_at: AT.toISOString() },
    ]);
  });

  test("C474: losing the compare-and-set returns the outcome already stored, not the one it tried", async () => {
    const { store: s } = store({ sequence: [ok([]), ok(readRow("unreadable", { read_error: "corrupt" }))] });

    expect(await s.recordRead(JOB, { status: "parsed", tables: 1, rows: 3 })).toEqual({ ok: true, outcome: { status: "unreadable", reason: "corrupt" } });
  });

  test("C474: a job still uploading is not_ready", async () => {
    const { store: s } = store({ sequence: [ok([]), ok(readRow("uploading"))] });

    expect(await s.recordRead(JOB, { status: "parsed", tables: 1, rows: 3 })).toEqual({ ok: false, code: "not_ready" });
  });

  test("C477: an update error XX000 is unavailable, logged once", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store: s } = store(fail("XX000"));

    expect(await s.recordRead(JOB, { status: "parsed", tables: 1, rows: 3 })).toEqual({ ok: false, code: "unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("ImportJobStore.confirmUploaded after a read", () => {
  test.each(["parsed", "unreadable"])("C479: a %s job is ok, with no storage call and no update", async (status) => {
    const { store: s, calls } = store(ok(jobRow(status)));

    expect(await s.confirmUploaded(JOB)).toEqual({ ok: true });
    expect(storageCalls(calls)).toEqual([]);
    expect(jobCalls(calls, "update")).toEqual([]);
  });
});

describe("ImportJobReader.forSite read columns", () => {
  test("C486: selects the read columns and maps each status to its outcome", async () => {
    const base = { original_name: "a.csv", size_bytes: 5, created_by_email: null, created_at: "2026-10-25T10:00:00Z" };
    const stub = stubClient({
      import_jobs: ok([
        { ...base, id: "j3", status: "parsed", read_error: null, table_count: 2, row_count: 15 },
        { ...base, id: "j2", status: "unreadable", read_error: "too_many_rows", table_count: null, row_count: null },
        { ...base, id: "j1", status: "uploaded", read_error: null, table_count: null, row_count: null },
      ]),
    });

    const jobs = await supabaseImportJobReader(stub.typed).forSite(SITE);

    const select = String(stub.calls.find((call) => call.method === "select")?.args[0]);
    for (const column of ["read_error", "table_count", "row_count"]) expect(select).toContain(column);
    expect(jobs.map((job) => [job.status, job.outcome])).toEqual([
      ["parsed", { status: "parsed", tables: 2, rows: 15 }],
      ["unreadable", { status: "unreadable", reason: "too_many_rows" }],
      ["uploaded", null],
    ]);
  });
});
