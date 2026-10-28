import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseAgreementReader, supabaseAgreementStore, supabaseServiceLineStore } from "./agreements";
import { stubClient, type Reply } from "./stub-client";

const AGR = "11111111-1111-4111-8111-111111111111";
const SITE = "33333333-3333-4333-8333-333333333333";
const LINE = "44444444-4444-4444-8444-444444444444";
const VALUE = { description: "Preventive maintenance visit", visitsPerYear: 4, costPerVisitCents: 89250 };

const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (code: string): Reply => ({ data: null, error: { code, message: `boom ${code}` } });

afterEach(() => {
  vi.restoreAllMocks();
});

const agreementRow = (versions: { id: string; version_no: number; created_at?: string }[], status = "draft") => ({
  id: AGR,
  number: "AG-1052",
  status,
  sites: { id: "s1", name: "Harbourview Towers", customers: { id: "c1", name: "Harbourview Strata" } },
  agreement_versions: versions.map((version) => ({ created_at: "2026-10-27T17:00:00Z", contracts: [], ...version })),
});

const line = (id: string, position: number, created_at: string, visits = 4, cost = 89250) => ({
  id,
  position,
  description: `Line ${id}`,
  visits_per_year: visits,
  cost_per_visit_cents: cost,
  created_at,
});

describe("agreement reader", () => {
  const TWO = agreementRow([
    { id: "v1", version_no: 1, created_at: "2026-10-20T17:00:00Z" },
    { id: "v2", version_no: 2, created_at: "2026-10-27T17:00:00Z" },
  ]);

  test("C714: lines come back by position, then by creation time", async () => {
    const rows = [
      line("p2", 2, "2026-10-27T08:00:00Z"),
      line("p0", 0, "2026-10-27T11:00:00Z"),
      line("p1-late", 1, "2026-10-27T10:00:00Z"),
      line("p1-early", 1, "2026-10-27T09:00:00Z"),
    ];
    const { typed } = stubClient({ agreements: ok(TWO), service_lines: ok(rows) });
    const detail = await supabaseAgreementReader(typed).get(AGR);
    expect(detail?.shown.lines.map((l) => l.id)).toEqual(["p0", "p1-early", "p1-late", "p2"]);
  });

  test("C725: each line's annual amount is visits x cost, and the version's is their sum", async () => {
    const rows = [line("a", 0, "2026-10-27T08:00:00Z", 4, 89250), line("b", 1, "2026-10-27T09:00:00Z", 2, 15000)];
    const { typed } = stubClient({ agreements: ok(TWO), service_lines: ok(rows) });
    const detail = await supabaseAgreementReader(typed).get(AGR);
    expect(detail?.shown.lines.map((l) => l.annualCents)).toEqual([357000, 30000]);
    expect(detail?.shown.annualCents).toBe(387000);
    expect(detail?.shown.lines[0]).toEqual({
      id: "a",
      position: 0,
      description: "Line a",
      visitsPerYear: 4,
      costPerVisitCents: 89250,
      annualCents: 357000,
    });
  });

  test("C725: a version with no lines totals 0", async () => {
    const { typed } = stubClient({ agreements: ok(TWO), service_lines: ok([]) });
    const detail = await supabaseAgreementReader(typed).get(AGR);
    expect(detail?.shown).toMatchObject({ lines: [], annualCents: 0 });
  });

  test("C727: get(id, 1) shows version 1, not current, with version 1's lines", async () => {
    const { typed, calls } = stubClient({ agreements: ok(TWO), service_lines: ok([line("a", 0, "2026-10-20T08:00:00Z")]) });
    const detail = await supabaseAgreementReader(typed).get(AGR, 1);
    expect(detail?.shown).toMatchObject({ versionNo: 1, current: false });
    expect(detail?.shown.lines.map((l) => l.id)).toEqual(["a"]);
    expect(detail?.editable).toBe(false);
    expect(calls).toContainEqual({ table: "service_lines", method: "eq", args: ["agreement_version_id", "v1"] });
  });

  test.each<[string, number | undefined]>([
    ["no version", undefined],
    ["version 9", 9],
    ["version 0", 0],
  ])("C727: %s shows the current version 2", async (_, versionNo) => {
    const { typed, calls } = stubClient({ agreements: ok(TWO), service_lines: ok([]) });
    const detail = await supabaseAgreementReader(typed).get(AGR, versionNo);
    expect(detail?.shown).toMatchObject({ versionNo: 2, current: true });
    expect(detail?.editable).toBe(true);
    expect(calls).toContainEqual({ table: "service_lines", method: "eq", args: ["agreement_version_id", "v2"] });
  });

  test("the detail carries the number, status, stage, site, customer and versions newest first", async () => {
    const { typed } = stubClient({ agreements: ok(TWO), service_lines: ok([]) });
    const detail = await supabaseAgreementReader(typed).get(AGR);
    expect(detail).toMatchObject({
      id: AGR,
      number: "AG-1052",
      status: "draft",
      stage: "in_progress",
      site: { id: "s1", name: "Harbourview Towers" },
      customer: { id: "c1", name: "Harbourview Strata" },
    });
    expect(detail?.versions).toEqual([
      { versionNo: 2, createdAt: new Date("2026-10-27T17:00:00Z") },
      { versionNo: 1, createdAt: new Date("2026-10-20T17:00:00Z") },
    ]);
  });

  test("a sent agreement's current version is not editable", async () => {
    const { typed } = stubClient({ agreements: ok(agreementRow([{ id: "v1", version_no: 1 }], "sent")), service_lines: ok([]) });
    expect((await supabaseAgreementReader(typed).get(AGR))?.editable).toBe(false);
  });

  test("C741: a malformed id is null without a query, and no row is null", async () => {
    const malformed = stubClient({});
    expect(await supabaseAgreementReader(malformed.typed).get("abc")).toBeNull();
    expect(malformed.calls).toHaveLength(0);
    expect(await supabaseAgreementReader(stubClient({ agreements: ok(null) }).typed).get(AGR)).toBeNull();
  });

  test("an unexpected read error throws", async () => {
    await expect(supabaseAgreementReader(stubClient({ agreements: fail("XX000") }).typed).get(AGR)).rejects.toThrow("XX000");
  });
});

describe("agreement store", () => {
  function storeWith(rpcReply: Reply, agreements: Reply = ok(null)) {
    const stub = stubClient({ agreements });
    stub.client.rpc.mockResolvedValue(rpcReply);
    return { ...stub, store: supabaseAgreementStore(stub.typed) };
  }

  test("C704: create calls create_agreement with the site id and returns the new id", async () => {
    const { store, client } = storeWith(ok(AGR));
    expect(await store.create(SITE)).toEqual({ ok: true, id: AGR });
    expect(client.rpc).toHaveBeenCalledWith("create_agreement", { p_site_id: SITE });
  });

  test.each<[string, Reply, Reply, unknown, number]>([
    ["23505", fail("23505"), ok({ id: "live-1", number: "AG-1048" }), { ok: false, code: "open_exists", agreementId: "live-1", number: "AG-1048" }, 0],
    ["P0002", fail("P0002"), ok(null), { ok: false, code: "not_found" }, 0],
    ["42501", fail("42501"), ok(null), { ok: false, code: "forbidden" }, 0],
    ["XX000", fail("XX000"), ok(null), { ok: false, code: "unavailable" }, 1],
  ])("C710: create maps %s", async (_, rpcReply, liveRead, expected, logged) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, calls } = storeWith(rpcReply, liveRead);
    expect(await store.create(SITE)).toEqual(expected);
    expect(error).toHaveBeenCalledTimes(logged);
    if (rpcReply.error?.code === "23505") {
      expect(calls).toContainEqual({ table: "agreements", method: "eq", args: ["site_id", SITE] });
      expect(calls).toContainEqual({ table: "agreements", method: "in", args: ["status", ["draft", "sent", "changes_requested"]] });
    }
  });

  test.each<[string, () => ReturnType<typeof storeWith>]>([
    ["a thrown rpc", () => {
      const stub = storeWith(ok(null));
      stub.client.rpc.mockRejectedValue(new Error("network down"));
      return stub;
    }],
    ["a failed read of the live agreement", () => storeWith(fail("23505"), fail("XX000"))],
  ])("C744: create answers unavailable with one console.error after %s", async (_, make) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await make().store.create(SITE)).toEqual({ ok: false, code: "unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("service line store", () => {
  const VERSION = { id: "v3", org_id: "org-from-row" };

  test("C719: add inserts after the highest position of the current version, with org_id from the version row", async () => {
    const { typed, calls } = stubClient({
      agreement_versions: ok([VERSION]),
      service_lines: { sequence: [ok([{ position: 0 }, { position: 4 }, { position: 2 }]), ok([{ id: "new-line" }])] },
    });
    expect(await supabaseServiceLineStore(typed).add(AGR, VALUE)).toEqual({ ok: true, id: "new-line" });
    expect(calls).toContainEqual({ table: "agreement_versions", method: "eq", args: ["agreement_id", AGR] });
    expect(calls).toContainEqual({ table: "agreement_versions", method: "order", args: ["version_no", { ascending: false }] });
    expect(calls).toContainEqual({ table: "agreement_versions", method: "limit", args: [1] });
    expect(calls).toContainEqual({ table: "service_lines", method: "eq", args: ["agreement_version_id", "v3"] });
    const insert = calls.find((call) => call.table === "service_lines" && call.method === "insert");
    expect(insert?.args[0]).toEqual({
      org_id: "org-from-row",
      agreement_version_id: "v3",
      position: 5,
      description: "Preventive maintenance visit",
      visits_per_year: 4,
      cost_per_visit_cents: 89250,
    });
    expect(Object.keys(insert?.args[0] as object).sort()).toEqual(
      ["agreement_version_id", "cost_per_visit_cents", "description", "org_id", "position", "visits_per_year"],
    );
  });

  test("C719: the first line of an empty version is at position 0", async () => {
    const { typed, calls } = stubClient({
      agreement_versions: ok([VERSION]),
      service_lines: { sequence: [ok([]), ok([{ id: "first" }])] },
    });
    expect(await supabaseServiceLineStore(typed).add(AGR, VALUE)).toEqual({ ok: true, id: "first" });
    expect((calls.find((call) => call.method === "insert")?.args[0] as { position: number }).position).toBe(0);
  });

  test("C722: a version holding 50 lines is too_many and nothing is inserted", async () => {
    const fifty = Array.from({ length: 50 }, (_, position) => ({ position }));
    const { typed, calls } = stubClient({ agreement_versions: ok([VERSION]), service_lines: ok(fifty) });
    expect(await supabaseServiceLineStore(typed).add(AGR, VALUE)).toEqual({ ok: false, code: "too_many" });
    expect(calls.filter((call) => call.method === "insert")).toHaveLength(0);
  });

  test("C737: add, update and remove map 55000 to locked", async () => {
    const add = stubClient({ agreement_versions: ok([VERSION]), service_lines: { sequence: [ok([]), fail("55000")] } });
    expect(await supabaseServiceLineStore(add.typed).add(AGR, VALUE)).toEqual({ ok: false, code: "locked" });
    const write = stubClient({ service_lines: fail("55000") });
    expect(await supabaseServiceLineStore(write.typed).update(LINE, VALUE)).toEqual({ ok: false, code: "locked" });
    expect(await supabaseServiceLineStore(write.typed).remove(LINE)).toEqual({ ok: false, code: "locked" });
  });

  test("C724: update and remove write the one line by id and answer ok", async () => {
    const { typed, calls } = stubClient({ service_lines: ok([{ id: LINE }]) });
    expect(await supabaseServiceLineStore(typed).update(LINE, VALUE)).toEqual({ ok: true });
    expect(calls).toContainEqual({
      table: "service_lines",
      method: "update",
      args: [{ description: "Preventive maintenance visit", visits_per_year: 4, cost_per_visit_cents: 89250 }],
    });
    expect(await supabaseServiceLineStore(typed).remove(LINE)).toEqual({ ok: true });
    expect(calls).toContainEqual({ table: "service_lines", method: "delete", args: [] });
    expect(calls.filter((call) => call.method === "eq")).toEqual([
      { table: "service_lines", method: "eq", args: ["id", LINE] },
      { table: "service_lines", method: "eq", args: ["id", LINE] },
    ]);
  });

  test("C741: update and remove of a well-formed id matching no row are not_found; add with no version is not_found", async () => {
    const none = stubClient({ service_lines: ok([]) });
    expect(await supabaseServiceLineStore(none.typed).update(LINE, VALUE)).toEqual({ ok: false, code: "not_found" });
    expect(await supabaseServiceLineStore(none.typed).remove(LINE)).toEqual({ ok: false, code: "not_found" });
    const noVersion = stubClient({ agreement_versions: ok([]) });
    expect(await supabaseServiceLineStore(noVersion.typed).add(AGR, VALUE)).toEqual({ ok: false, code: "not_found" });
  });

  test("a 42501 is forbidden", async () => {
    const { typed } = stubClient({ service_lines: fail("42501") });
    expect(await supabaseServiceLineStore(typed).update(LINE, VALUE)).toEqual({ ok: false, code: "forbidden" });
  });

  test.each<[string, () => Promise<unknown>]>([
    ["add, on the version read", () =>
      supabaseServiceLineStore(stubClient({ agreement_versions: fail("XX000") }).typed).add(AGR, VALUE)],
    ["add, on the positions read", () =>
      supabaseServiceLineStore(stubClient({ agreement_versions: ok([VERSION]), service_lines: fail("XX000") }).typed).add(AGR, VALUE)],
    ["add, on the insert", () =>
      supabaseServiceLineStore(
        stubClient({ agreement_versions: ok([VERSION]), service_lines: { sequence: [ok([]), fail("XX000")] } }).typed,
      ).add(AGR, VALUE)],
    ["update", () => supabaseServiceLineStore(stubClient({ service_lines: fail("XX000") }).typed).update(LINE, VALUE)],
    ["remove", () => supabaseServiceLineStore(stubClient({ service_lines: fail("XX000") }).typed).remove(LINE)],
    ["a thrown add", () => {
      const stub = stubClient({});
      stub.client.from = (() => {
        throw new Error("network down");
      }) as never;
      return supabaseServiceLineStore(stub.typed).add(AGR, VALUE);
    }],
  ])("C744: %s fails as unavailable with exactly one console.error", async (_, run) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await run()).toEqual({ ok: false, code: "unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("agreement reader: the service scope", () => {
  const SCOPE = {
    schema: 1,
    types: [{ code: "RTU", name: "Rooftop unit", tasks: ["Replace filters"], assets: [{ unitNo: "RTU-1", typeModel: null, location: "Roof" }] }],
  };
  const TYPES = [{ code: "RTU", name: "Rooftop unit", tasks: ["Replace filters"], assets: [{ unitNo: "RTU-1", typeModel: null, location: "Roof" }] }];
  const TAKEN = "2026-10-27T18:00:00+00:00";
  const versions = [
    { id: "v1", version_no: 1 },
    { id: "v2", version_no: 2 },
  ];

  test("C804: the current version of a draft reads the live scope of its site", async () => {
    const stub = stubClient({ agreements: ok(agreementRow(versions)), service_lines: ok([]) });
    stub.client.rpc.mockResolvedValue(ok(SCOPE));
    const detail = await supabaseAgreementReader(stub.typed).get(AGR);
    expect(stub.client.rpc).toHaveBeenCalledTimes(1);
    expect(stub.client.rpc).toHaveBeenCalledWith("site_service_scope", { p_site_id: "s1" });
    expect(detail?.serviceScope).toEqual({ source: "live", takenAt: null, types: TYPES });
    expect(stub.calls.some((call) => call.table === "agreement_versions")).toBe(false);
  });

  test.each<[string, string, number | undefined, string]>([
    ["version 1 of a draft", "draft", 1, "v1"],
    ["the current version of a sent agreement", "sent", undefined, "v2"],
  ])("C804: %s reads its own snapshot, without the live scope", async (_, status, versionNo, versionId) => {
    const stub = stubClient({
      agreements: ok(agreementRow(versions, status)),
      service_lines: ok([]),
      agreement_versions: ok({ snapshot: { ...SCOPE, takenAt: TAKEN } }),
    });
    const detail = await supabaseAgreementReader(stub.typed).get(AGR, versionNo);
    expect(stub.client.rpc).not.toHaveBeenCalled();
    expect(stub.calls).toContainEqual({ table: "agreement_versions", method: "eq", args: ["id", versionId] });
    expect(detail?.serviceScope).toEqual({ source: "frozen", takenAt: new Date(TAKEN), types: TYPES });
  });

  test("C804: a frozen version holding {} was not recorded, and nothing is logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const stub = stubClient({ agreements: ok(agreementRow(versions, "sent")), service_lines: ok([]), agreement_versions: ok({ snapshot: {} }) });
    const detail = await supabaseAgreementReader(stub.typed).get(AGR);
    expect(detail?.serviceScope).toEqual({ source: "not_recorded" });
    expect(error).not.toHaveBeenCalled();
  });

  test("C804: a malformed snapshot was not recorded, and is logged once", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const stub = stubClient({
      agreements: ok(agreementRow(versions, "sent")),
      service_lines: ok([]),
      agreement_versions: ok({ snapshot: { schema: 1, types: 3 } }),
    });
    const detail = await supabaseAgreementReader(stub.typed).get(AGR);
    expect(detail?.serviceScope).toEqual({ source: "not_recorded" });
    expect(error).toHaveBeenCalledTimes(1);
  });

  test("C804: an error from the live scope rejects", async () => {
    const stub = stubClient({ agreements: ok(agreementRow(versions)), service_lines: ok([]) });
    stub.client.rpc.mockResolvedValue(fail("XX000"));
    await expect(supabaseAgreementReader(stub.typed).get(AGR)).rejects.toThrow("XX000");
  });
});

describe("agreement reader: terms and the customer link", () => {
  const TERMS = { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: null };
  const SNAPSHOT = { schema: 1, types: [], takenAt: "2026-10-27T18:00:00+00:00", terms: TERMS };
  const sent = agreementRow([{ id: "v1", version_no: 1 }], "sent");

  test("C936: a frozen version returns the terms of its snapshot", async () => {
    const stub = stubClient({ agreements: ok(sent), service_lines: ok([]), agreement_versions: ok({ snapshot: SNAPSHOT }) });
    const detail = await supabaseAgreementReader(stub.typed).get(AGR);
    expect(detail?.terms).toEqual(TERMS);
  });

  test("C936: the editable version has no terms and its snapshot is not read", async () => {
    const stub = stubClient({ agreements: ok(agreementRow([{ id: "v1", version_no: 1 }])), service_lines: ok([]) });
    stub.client.rpc.mockResolvedValue(ok({ schema: 1, types: [] }));
    const detail = await supabaseAgreementReader(stub.typed).get(AGR);
    expect(detail?.terms).toBeNull();
    expect(stub.calls.some((call) => call.table === "agreement_versions")).toBe(false);
  });

  test("C936: a frozen version whose snapshot has no terms, or malformed ones, gets null", async () => {
    for (const snapshot of [{ schema: 1, types: [], takenAt: SNAPSHOT.takenAt }, { ...SNAPSHOT, terms: [TERMS] }]) {
      const stub = stubClient({ agreements: ok(sent), service_lines: ok([]), agreement_versions: ok({ snapshot }) });
      expect((await supabaseAgreementReader(stub.typed).get(AGR))?.terms).toBeNull();
    }
  });

  test("C905: a sent agreement's current version reads the live link's first view", async () => {
    const stub = stubClient({
      agreements: ok(sent),
      service_lines: ok([]),
      agreement_versions: ok({ snapshot: SNAPSHOT }),
      portal_links: ok({ first_viewed_at: "2026-10-28T09:00:00Z" }),
    });
    const detail = await supabaseAgreementReader(stub.typed).get(AGR);
    expect(detail?.portalLink).toEqual({ firstViewedAt: new Date("2026-10-28T09:00:00Z") });
    expect(stub.calls.filter((call) => call.table === "portal_links" && call.method === "is")[0].args).toEqual(["revoked_at", null]);
  });

  test("C905: a live link nobody opened has a null first view, and no live link gives null", async () => {
    const unopened = stubClient({ agreements: ok(sent), service_lines: ok([]), agreement_versions: ok({ snapshot: SNAPSHOT }), portal_links: ok({ first_viewed_at: null }) });
    expect((await supabaseAgreementReader(unopened.typed).get(AGR))?.portalLink).toEqual({ firstViewedAt: null });
    const none = stubClient({ agreements: ok(sent), service_lines: ok([]), agreement_versions: ok({ snapshot: SNAPSHOT }) });
    expect((await supabaseAgreementReader(none.typed).get(AGR))?.portalLink).toBeNull();
  });

  test("C905: a draft, or a past version of a sent agreement, reads no link", async () => {
    const draft = stubClient({ agreements: ok(agreementRow([{ id: "v1", version_no: 1 }])), service_lines: ok([]) });
    draft.client.rpc.mockResolvedValue(ok({ schema: 1, types: [] }));
    await supabaseAgreementReader(draft.typed).get(AGR);
    const past = stubClient({ agreements: ok(agreementRow([{ id: "v1", version_no: 1 }, { id: "v2", version_no: 2 }], "sent")), service_lines: ok([]), agreement_versions: ok({ snapshot: SNAPSHOT }) });
    await supabaseAgreementReader(past.typed).get(AGR, 1);
    expect(draft.calls.some((call) => call.table === "portal_links")).toBe(false);
    expect(past.calls.some((call) => call.table === "portal_links")).toBe(false);
  });
});
