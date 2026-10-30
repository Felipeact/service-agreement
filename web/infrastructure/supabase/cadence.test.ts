import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseAgreementReader, supabaseServiceLineStore } from "./agreements";
import { supabasePortalReader } from "./portal";
import { stubClient, type Reply } from "./stub-client";

const AGR = "11111111-1111-4111-8111-111111111111";
const LINE = "44444444-4444-4444-8444-444444444444";
const RTU = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOILER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AHU = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VALUE = { description: "HVAC", visitMonths: [3, 6, 9, 12], costPerVisitCents: 25000, assetTypeIds: [RTU, BOILER] };

const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (code: string): Reply => ({ data: null, error: { code, message: `boom ${code}` } });

afterEach(() => {
  vi.restoreAllMocks();
});

const draft = {
  id: AGR,
  number: "AG-1046",
  status: "draft",
  sites: { id: "s1", name: "Harbourview Towers", customers: { id: "c1", name: "Harbourview Strata" } },
  agreement_versions: [{ id: "v1", version_no: 1, created_at: "2026-10-27T17:00:00Z", contracts: [] }],
};

const lineRow = (covers: { id: string; code: string; name: string }[]) => ({
  id: "l1",
  position: 0,
  description: "HVAC",
  visits_per_year: 4,
  visit_months: [3, 6, 9, 12],
  cost_per_visit_cents: 25000,
  created_at: "2026-10-27T17:00:00Z",
  service_line_asset_types: covers.map((type) => ({ asset_types: type })),
});

describe("agreement reader, cadence", () => {
  test("C1061: a line with months {3,6,9,12} at 25000 reads as 4 visits and 100000 a year, with its months", async () => {
    const stub = stubClient({ agreements: ok(draft), service_lines: ok([lineRow([{ id: RTU, code: "RTU", name: "Rooftop unit" }])]) });
    const detail = await supabaseAgreementReader(stub.typed).get(AGR);
    expect(detail?.shown.lines[0]).toMatchObject({ visitsPerYear: 4, annualCents: 100000, visitMonths: [3, 6, 9, 12] });
    expect(detail?.shown.lines[0].equipment).toEqual([{ id: RTU, code: "RTU", name: "Rooftop unit" }]);
  });

  test("C1067: the editable detail offers the site's types with an asset plus a covered type with none, by name", async () => {
    const stub = stubClient({
      agreements: ok(draft),
      service_lines: ok([lineRow([{ id: AHU, code: "AHU", name: "Air handling unit" }])]),
      assets: ok([{ asset_type_id: RTU }, { asset_type_id: BOILER }, { asset_type_id: RTU }]),
      asset_types: ok([
        { id: RTU, code: "RTU", name: "Rooftop unit", default_visit_months: [3, 6, 9, 12] },
        { id: BOILER, code: "BOILER", name: "Boiler", default_visit_months: [10] },
        { id: AHU, code: "AHU", name: "Air handling unit", default_visit_months: [3, 6, 9, 12] },
      ]),
    });
    const detail = await supabaseAgreementReader(stub.typed).get(AGR);
    expect(detail?.equipmentChoices).toEqual([
      { id: AHU, code: "AHU", name: "Air handling unit", defaultVisitMonths: [3, 6, 9, 12] },
      { id: BOILER, code: "BOILER", name: "Boiler", defaultVisitMonths: [10] },
      { id: RTU, code: "RTU", name: "Rooftop unit", defaultVisitMonths: [3, 6, 9, 12] },
    ]);
    expect(stub.calls).toContainEqual({ table: "assets", method: "eq", args: ["site_id", "s1"] });
    const asked = stub.calls.find((call) => call.table === "asset_types" && call.method === "in")?.args[1] as string[];
    expect([...asked].sort()).toEqual([AHU, BOILER, RTU].sort());
  });

  test("C1067: a version that is not editable offers no choices", async () => {
    const sent = { ...draft, status: "sent" };
    const stub = stubClient({ agreements: ok(sent), service_lines: ok([]), agreement_versions: ok({ snapshot: {} }), assets: ok([{ asset_type_id: RTU }]) });
    expect((await supabaseAgreementReader(stub.typed).get(AGR))?.equipmentChoices).toEqual([]);
  });
});

describe("service line store, cadence", () => {
  const ARGS = { p_agreement_id: AGR, p_description: "HVAC", p_visit_months: [3, 6, 9, 12], p_cost_per_visit_cents: 25000, p_asset_type_ids: [RTU, BOILER] };
  const LINE_ROW = ok([{ id: LINE, agreement_versions: { agreement_id: AGR } }]);

  function store(reply: Reply) {
    const stub = stubClient({ service_lines: LINE_ROW });
    stub.client.rpc.mockResolvedValue(reply);
    return { ...stub, store: supabaseServiceLineStore(stub.typed) };
  }

  test("C1072: add and update call save_service_line with the six named arguments, a null line id on add", async () => {
    const add = store(ok(LINE));
    await add.store.add(AGR, VALUE);
    expect(add.client.rpc.mock.calls).toEqual([["save_service_line", { ...ARGS, p_line_id: null }]]);
    const update = store(ok(LINE));
    await update.store.update(LINE, VALUE);
    expect(update.client.rpc.mock.calls).toEqual([["save_service_line", { ...ARGS, p_line_id: LINE }]]);
    expect(Object.keys(update.client.rpc.mock.calls[0][1] as object).sort()).toEqual(
      ["p_agreement_id", "p_asset_type_ids", "p_cost_per_visit_cents", "p_description", "p_line_id", "p_visit_months"],
    );
  });

  test.each([
    ["55000", "locked"],
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["23503", "not_found"],
    ["54000", "too_many"],
    ["23514", "unavailable"],
    ["XX000", "unavailable"],
  ])("C1072: on add, %s is %s", async (code, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await store(fail(code)).store.add(AGR, VALUE)).toEqual({ ok: false, code: expected });
  });

  test.each([
    ["55000", "locked"],
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["23503", "not_found"],
    ["XX000", "unavailable"],
  ])("C1072: on update, %s is %s", async (code, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await store(fail(code)).store.update(LINE, VALUE)).toEqual({ ok: false, code: expected });
  });
});

describe("portal reader, cadence", () => {
  const DOCUMENT = {
    link: { versionNo: 1, current: true, revoked: false, revokedAt: null, firstViewedAt: null },
    agreement: { number: "AG-1046", status: "sent" },
    tenant: { name: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accent: null },
    customer: { name: "Fernwood Dental" },
    site: { name: "Main" },
    lines: [
      {
        description: "HVAC",
        visitsPerYear: 4,
        costPerVisitCents: 25000,
        annualCents: 100000,
        visitMonths: [3, 6, 9, 12],
        equipment: [
          { code: "AHU", name: "AHU" },
          { code: "RTU", name: "RTU" },
        ],
      },
    ],
    annualCents: 100000,
    scope: null,
    terms: null,
    decision: null,
  };

  test("C1082: each line's visitMonths and equipment land on PortalView.lines", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: DOCUMENT, error: null });
    const view = await supabasePortalReader(typed).view("a".repeat(64));
    expect(view?.lines).toEqual([
      {
        description: "HVAC",
        visitsPerYear: 4,
        costPerVisitCents: 25000,
        annualCents: 100000,
        visitMonths: [3, 6, 9, 12],
        equipment: [
          { code: "AHU", name: "AHU" },
          { code: "RTU", name: "RTU" },
        ],
      },
    ]);
  });

  test("C1082: an unknown link (null) is null", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await supabasePortalReader(typed).view("a".repeat(64))).toBeNull();
  });
});

describe("generated database types", () => {
  test("C1096: visit_months, default_visit_months, service_line_asset_types and save_service_line are listed", () => {
    const types = readFileSync(path.join(import.meta.dirname, "database.types.ts"), "utf8");
    const block = (name: string) => {
      const start = types.indexOf(`      ${name}: {`);
      return start < 0 ? "" : types.slice(start, types.indexOf("\n      }", start));
    };
    expect(block("service_lines")).toContain("visit_months: number[]");
    expect(block("asset_types")).toContain("default_visit_months: number[]");
    expect(block("service_line_asset_types")).toContain("service_line_id: string");
    expect(block("save_service_line")).toContain("p_visit_months: number[]");
    expect(block("save_service_line")).toContain("p_asset_type_ids: string[]");
  });
});
