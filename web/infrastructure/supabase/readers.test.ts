import { describe, expect, test } from "vitest";
import { fixedClock } from "@/infrastructure/clock";
import {
  supabaseAgreementLister,
  supabaseAssetTypeCatalog,
  supabaseCustomerDirectory,
  supabasePipelineReader,
  supabaseRecordSearch,
  supabaseSiteDirectory,
  supabaseSiteLister,
  supabaseSiteRegister,
} from "./readers";
import { stubClient } from "./stub-client";

const ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-24T12:00:00Z");

type Line = { visits_per_year: number; cost_per_visit_cents: number };
type Version = { version_no: number; contracts: { status: string }[]; service_lines: Line[] };

function agreement(id: string, status: string, patch: { contract?: string; updated_at?: string; versions?: Version[]; number?: string | null } = {}) {
  return {
    id,
    number: patch.number === undefined ? `AG-${id}` : patch.number,
    status,
    updated_at: patch.updated_at ?? "2026-10-20T00:00:00Z",
    sites: { customers: { name: `Customer ${id}` } },
    agreement_versions: patch.versions ?? [
      {
        version_no: 1,
        contracts: patch.contract ? [{ status: patch.contract }] : [],
        service_lines: [{ visits_per_year: 4, cost_per_visit_cents: 100000 }],
      },
    ],
  };
}

const ok = (data: unknown) => ({ data, error: null });
const fail = (code: string) => ({ data: null, error: { code, message: `boom ${code}` } });

async function board(rows: unknown[]) {
  const { typed } = stubClient({ agreements: ok(rows) });
  return supabasePipelineReader(typed, fixedClock(NOW)).board();
}

describe("pipeline reader", () => {
  test("C110: each agreement and contract status lands in its stage", async () => {
    const cases: [string, string | undefined, string][] = [
      ["draft", undefined, "in_progress"],
      ["changes_requested", undefined, "in_progress"],
      ["sent", undefined, "sent"],
      ["accepted", undefined, "accepted"],
      ["accepted", "pending_signature", "accepted"],
      ["accepted", "client_signed", "accepted"],
      ["accepted", "completed", "completed"],
      ["refused", undefined, "refused"],
      ["expired", undefined, "refused"],
      ["accepted", "declined", "refused"],
    ];
    const cards = await board(cases.map(([status, contract], index) => agreement(`a${index}`, status, { contract })));
    expect(cards.map((card) => [card.id, card.stage])).toEqual(cases.map(([, , stage], index) => [`a${index}`, stage]));
  });

  test("C111: withdrawn agreements and voided contracts are off the board", async () => {
    const cards = await board([
      agreement("w", "withdrawn"),
      agreement("v", "accepted", { contract: "voided" }),
      agreement("d", "draft"),
    ]);
    expect(cards.map((card) => card.id)).toEqual(["d"]);
  });

  test("C114: age is whole days since updated_at, never negative", async () => {
    const cards = await board([
      agreement("nine", "draft", { updated_at: "2026-10-15T09:00:00Z" }),
      agreement("almost", "draft", { updated_at: "2026-10-23T12:00:01Z" }),
      agreement("exact", "draft", { updated_at: "2026-10-23T12:00:00Z" }),
      agreement("future", "draft", { updated_at: "2026-10-25T00:00:00Z" }),
    ]);
    expect(Object.fromEntries(cards.map((card) => [card.id, card.ageDays]))).toEqual({ nine: 9, almost: 0, exact: 1, future: 0 });
  });

  test("C115: amounts come from the highest version only", async () => {
    const [card] = await board([
      agreement("a", "draft", {
        versions: [
          { version_no: 1, contracts: [], service_lines: [{ visits_per_year: 12, cost_per_visit_cents: 999999 }] },
          {
            version_no: 2,
            contracts: [],
            service_lines: [
              { visits_per_year: 4, cost_per_visit_cents: 100000 },
              { visits_per_year: 2, cost_per_visit_cents: 50000 },
            ],
          },
        ],
      }),
    ]);
    expect(card).toMatchObject({ annualCents: 500000, visitsPerYear: 4, versionNo: 2 });
  });

  test("C116: a version without service lines has no visits and no amount", async () => {
    const [card] = await board([agreement("a", "draft", { versions: [{ version_no: 1, contracts: [], service_lines: [] }] })]);
    expect(card.visitsPerYear).toBeUndefined();
    expect(card.annualCents).toBeUndefined();
  });

  test("C117: attention labels", async () => {
    const cards = await board([
      agreement("cr", "changes_requested"),
      agreement("cs", "accepted", { contract: "client_signed" }),
      agreement("d", "draft"),
      agreement("s", "sent"),
      agreement("ps", "accepted", { contract: "pending_signature" }),
    ]);
    expect(Object.fromEntries(cards.map((card) => [card.id, card.attention]))).toEqual({
      cr: "Changes requested",
      cs: "Awaiting countersignature",
      d: undefined,
      s: undefined,
      ps: undefined,
    });
  });

  test("C113: a null number is carried as null", async () => {
    const [card] = await board([agreement("a", "draft", { number: null })]);
    expect(card.number).toBeNull();
  });

  test("C1053: each card carries its site's name and that site's customer", async () => {
    const row = { ...agreement("a", "draft"), sites: { name: "Harbourview Tower A", customers: { name: "Harbourview Towers Strata" } } };
    const { typed, calls } = stubClient({ agreements: ok([row]) });
    const [card] = await supabasePipelineReader(typed, fixedClock(NOW)).board();

    const select = calls.find((call) => call.table === "agreements" && call.method === "select");
    expect(String(select?.args[0])).toContain("sites(name, customers(name))");
    expect(card.site).toBe("Harbourview Tower A");
    expect(card.customer).toBe("Harbourview Towers Strata");
  });

  test("C155: the agreements query is capped at 500 rows", async () => {
    const { typed, calls } = stubClient({ agreements: ok([]) });
    await supabasePipelineReader(typed, fixedClock(NOW)).board();
    expect(calls).toContainEqual({ table: "agreements", method: "limit", args: [500] });
  });
});

type ContactRow = { id: string; name: string; email: string | null; phone: string | null; created_at: string };
const contact = (id: string, name: string, created_at: string): ContactRow => ({ id, name, email: null, phone: null, created_at });

type SiteRow = { deactivated_at: string | null; assets: { deactivated_at: string | null }[] };
const units = (active: number, inactive = 0) => [
  ...Array.from({ length: active }, () => ({ deactivated_at: null })),
  ...Array.from({ length: inactive }, () => ({ deactivated_at: "2026-11-01T00:00:00Z" })),
];

function customerRow(id: string, name: string, patch: { contacts?: ContactRow[]; sites?: SiteRow[]; deactivated_at?: string | null } = {}) {
  return { id, name, deactivated_at: patch.deactivated_at ?? null, contacts: patch.contacts ?? [], sites: patch.sites ?? [] };
}

async function customers(rows: unknown[]) {
  const { typed } = stubClient({ customers: ok(rows) });
  return supabaseCustomerDirectory(typed).list();
}

describe("customer directory list", () => {
  test("C121: customers come back ordered by name, ignoring case", async () => {
    const list = await customers([customerRow("1", "bravo"), customerRow("2", "Alpha"), customerRow("3", "charlie")]);
    expect(list.map((customer) => customer.name)).toEqual(["Alpha", "bravo", "charlie"]);
  });

  test("C122: site and asset counts add up", async () => {
    const [customer] = await customers([
      customerRow("1", "A", { sites: [{ deactivated_at: null, assets: units(3) }, { deactivated_at: null, assets: units(4) }] }),
    ]);
    expect(customer).toMatchObject({ siteCount: 2, assetCount: 7 });
  });

  test("C1304: counts are of active sites and their active assets, and each customer says whether it is active", async () => {
    const [active, inactive] = await customers([
      customerRow("1", "A", {
        sites: [
          { deactivated_at: null, assets: units(2, 1) },
          { deactivated_at: "2026-11-01T00:00:00Z", assets: units(3) },
        ],
      }),
      customerRow("2", "B", { deactivated_at: "2026-11-01T00:00:00Z" }),
    ]);
    expect(active).toMatchObject({ active: true, siteCount: 1, assetCount: 2 });
    expect(inactive.active).toBe(false);
  });

  test("C123: the primary contact is the earliest created, ties by name", async () => {
    const [early, tie, none] = await customers([
      customerRow("1", "A", { contacts: [contact("c2", "Zed", "2026-02-01T00:00:00Z"), contact("c1", "Yan", "2026-01-01T00:00:00Z")] }),
      customerRow("2", "B", { contacts: [contact("c3", "Zed", "2026-01-01T00:00:00Z"), contact("c4", "Amy", "2026-01-01T00:00:00Z")] }),
      customerRow("3", "C"),
    ]);
    expect(early.primaryContact).toBe("Yan");
    expect(tie.primaryContact).toBe("Amy");
    expect(none.primaryContact).toBeNull();
  });

  test("C155: the customers query is capped at 500 rows", async () => {
    const { typed, calls } = stubClient({ customers: ok([]) });
    await supabaseCustomerDirectory(typed).list();
    expect(calls).toContainEqual({ table: "customers", method: "limit", args: [500] });
  });
});

function siteWithAgreements() {
  return {
    id: ID,
    name: "Customer",
    contacts: [contact("c-late", "Late", "2026-03-01T00:00:00Z"), contact("c-early", "Early", "2026-01-01T00:00:00Z")],
    sites: [
      {
        id: "s-late",
        name: "Late site",
        address: null,
        site_contact_id: "c-early",
        created_at: "2026-02-01T00:00:00Z",
        deactivated_at: null,
        assets: units(5),
        agreements: [
          { ...agreement("old", "sent", { updated_at: "2026-09-01T00:00:00Z" }), sites: undefined },
          {
            ...agreement("new", "sent", {
              updated_at: "2026-10-01T00:00:00Z",
              versions: [{ version_no: 1, contracts: [], service_lines: [{ visits_per_year: 4, cost_per_visit_cents: 400000 }] }],
            }),
            sites: undefined,
          },
        ],
      },
      {
        id: "s-early",
        name: "Early site",
        address: "1 Main St",
        site_contact_id: null,
        created_at: "2026-01-01T00:00:00Z",
        deactivated_at: "2026-11-01T00:00:00Z",
        assets: units(1, 2),
        agreements: [],
      },
    ],
  };
}

describe("customer directory detail", () => {
  test("C104: a malformed id returns null without querying", async () => {
    const { typed, calls } = stubClient({});
    expect(await supabaseCustomerDirectory(typed).detail("not-a-uuid")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test("C104: no row returns null, an unexpected error throws", async () => {
    expect(await supabaseCustomerDirectory(stubClient({ customers: ok(null) }).typed).detail(ID)).toBeNull();
    await expect(supabaseCustomerDirectory(stubClient({ customers: fail("XX000") }).typed).detail(ID)).rejects.toThrow("XX000");
  });

  test("C132: the agreement amount is visits x cost of the latest version", async () => {
    const detail = await supabaseCustomerDirectory(stubClient({ customers: ok(siteWithAgreements()) }).typed).detail(ID);
    expect(detail?.agreements[0]).toMatchObject({ id: "new", siteName: "Late site", stage: "sent", versionNo: 1, annualCents: 1600000 });
  });

  test("C134: contacts and sites by created_at, agreements newest update first", async () => {
    const detail = await supabaseCustomerDirectory(stubClient({ customers: ok(siteWithAgreements()) }).typed).detail(ID);
    expect(detail?.contacts.map((c) => c.id)).toEqual(["c-early", "c-late"]);
    expect(detail?.sites.map((s) => s.id)).toEqual(["s-early", "s-late"]);
    expect(detail?.agreements.map((a) => a.id)).toEqual(["new", "old"]);
    expect(detail?.sites[1]).toMatchObject({ contactName: "Early", assetCount: 5 });
  });

  test("C1305: the customer and each site say whether they are active; a site counts its active assets", async () => {
    const detail = await supabaseCustomerDirectory(stubClient({ customers: ok({ ...siteWithAgreements(), deactivated_at: "2026-11-01T00:00:00Z" }) }).typed).detail(ID);
    expect(detail?.active).toBe(false);
    expect(detail?.sites.map((site) => [site.id, site.active, site.assetCount])).toEqual([
      ["s-early", false, 1],
      ["s-late", true, 5],
    ]);
  });
});

describe("site register", () => {
  const row = {
    id: ID,
    name: "Site",
    address: "1 Main St",
    customer_id: "cust",
    site_contact_id: "c1",
    customers: { name: "Customer", contacts: [{ id: "c1", name: "Dana" }] },
    assets: [{ id: "a1", unit_no: "B-1", type_model: null, location: null, source: "import", asset_types: { code: "BOILER", name: "Boiler" } }],
  };

  test("C104: a malformed id returns null without querying", async () => {
    const { typed, calls } = stubClient({});
    expect(await supabaseSiteRegister(typed).get("not-a-uuid")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test("C104: no row returns null, an unexpected error throws", async () => {
    expect(await supabaseSiteRegister(stubClient({ sites: ok(null) }).typed).get(ID)).toBeNull();
    await expect(supabaseSiteRegister(stubClient({ sites: fail("XX000") }).typed).get(ID)).rejects.toThrow("XX000");
  });

  test("the register carries the customer, contact and assets", async () => {
    const site = await supabaseSiteRegister(stubClient({ sites: ok(row) }).typed).get(ID);
    expect(site).toMatchObject({ customerId: "cust", customerName: "Customer", contactName: "Dana" });
    expect(site?.assets[0]).toMatchObject({ typeCode: "BOILER", typeName: "Boiler", unitNo: "B-1", source: "import" });
  });

  test("C1305: the register says whether the site, its customer and each asset are active, and names a replacement", async () => {
    const site = await supabaseSiteRegister(
      stubClient({
        sites: ok({
          ...row,
          deactivated_at: "2026-11-01T00:00:00Z",
          customers: { ...row.customers, deactivated_at: null },
          assets: [
            { id: "a1", unit_no: "RTU-1", type_model: null, location: null, source: "manual", deactivated_at: "2026-11-01T00:00:00Z", replaced_by_asset_id: "a2", asset_types: { code: "RTU", name: "Rooftop unit" } },
            { id: "a2", unit_no: "RTU-2", type_model: null, location: null, source: "manual", deactivated_at: null, replaced_by_asset_id: null, asset_types: { code: "RTU", name: "Rooftop unit" } },
            { id: "a3", unit_no: null, type_model: null, location: null, source: "manual", deactivated_at: null, replaced_by_asset_id: null, asset_types: { code: "MUA", name: "Make-up air" } },
            { id: "a4", unit_no: "MUA-0", type_model: null, location: null, source: "manual", deactivated_at: "2026-11-01T00:00:00Z", replaced_by_asset_id: "a3", asset_types: { code: "MUA", name: "Make-up air" } },
          ],
        }),
      }).typed,
    ).get(ID);
    expect(site).toMatchObject({ active: false, customerActive: true });
    expect(site?.assets.map((asset) => [asset.id, asset.active, asset.replacedBy])).toEqual([
      ["a1", false, "RTU-2"],
      ["a2", true, null],
      ["a3", true, null],
      ["a4", false, "MUA"],
    ]);
  });

  test("C155: the assets of a site are capped at 500 rows", async () => {
    const { typed, calls } = stubClient({ sites: ok(row) });
    await supabaseSiteRegister(typed).get(ID);
    expect(calls).toContainEqual({ table: "sites", method: "limit", args: [500, { foreignTable: "assets" }] });
  });

  test.each<[string, string | null]>([
    ["draft", "draft"],
    ["sent", "sent"],
    ["changes_requested", "changes_requested"],
    ["accepted", null],
    ["refused", null],
    ["expired", null],
    ["withdrawn", null],
    ["none", null],
  ])("C703: a site whose agreement is %s has liveAgreement %s", async (status, live) => {
    const agreements =
      status === "none"
        ? []
        : [
            { id: "old", number: "AG-1001", status: "withdrawn" },
            { id: "g1", number: "AG-1048", status },
          ];
    const site = await supabaseSiteRegister(stubClient({ sites: ok({ ...row, agreements }) }).typed).get(ID);
    expect(site?.liveAgreement).toEqual(live ? { id: "g1", number: "AG-1048", status: live } : null);
  });

  test("C703: the register reads the site's agreements with their id, number and status", async () => {
    const { typed, calls } = stubClient({ sites: ok({ ...row, agreements: [] }) });
    await supabaseSiteRegister(typed).get(ID);
    const select = String(calls.find((call) => call.table === "sites" && call.method === "select")?.args[0]);
    expect(select.replace(/\s+/g, " ")).toContain("agreements(id, number, status)");
  });
});

describe("record reads for the edit forms", () => {
  test("the site register carries the site contact id", async () => {
    const row = {
      id: ID,
      name: "Site",
      address: null,
      customer_id: "cust",
      site_contact_id: "c1",
      customers: { name: "Customer", contacts: [{ id: "c1", name: "Dana" }] },
      assets: [],
    };
    expect(await supabaseSiteRegister(stubClient({ sites: ok(row) }).typed).get(ID)).toMatchObject({ siteContactId: "c1" });
  });

  test("C332: a malformed contact or asset id returns null without querying", async () => {
    const { typed, calls } = stubClient({});
    expect(await supabaseCustomerDirectory(typed).contact("not-a-uuid")).toBeNull();
    expect(await supabaseSiteRegister(typed).asset("not-a-uuid")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test("C332: no contact or asset row returns null", async () => {
    expect(await supabaseCustomerDirectory(stubClient({ contacts: ok(null) }).typed).contact(ID)).toBeNull();
    expect(await supabaseSiteRegister(stubClient({ assets: ok(null) }).typed).asset(ID)).toBeNull();
  });

  test("a contact and an asset map to their edit records; an unexpected error throws", async () => {
    const contactRow = { id: ID, customer_id: "cust", name: "Dana", email: "dana@example.com", phone: null };
    expect(await supabaseCustomerDirectory(stubClient({ contacts: ok(contactRow) }).typed).contact(ID)).toEqual({
      id: ID,
      customerId: "cust",
      name: "Dana",
      email: "dana@example.com",
      phone: null,
    });

    const assetRow = { id: ID, site_id: "s1", asset_type_id: "t1", unit_no: "1", type_model: null, location: "Roof" };
    expect(await supabaseSiteRegister(stubClient({ assets: ok(assetRow) }).typed).asset(ID)).toEqual({
      id: ID,
      siteId: "s1",
      assetTypeId: "t1",
      unitNo: "1",
      typeModel: null,
      location: "Roof",
      active: true,
    });
    await expect(supabaseSiteRegister(stubClient({ assets: fail("XX000") }).typed).asset(ID)).rejects.toThrow("XX000");
  });

  test("C323: asset types are read ordered by name and mapped to id, code and name", async () => {
    const { typed, calls } = stubClient({ asset_types: ok([{ id: "t1", code: "BOILER", name: "Boiler" }, { id: "t2", code: "RTU", name: "Rooftop unit" }]) });
    expect(await supabaseAssetTypeCatalog(typed).list()).toEqual([
      { id: "t1", code: "BOILER", name: "Boiler" },
      { id: "t2", code: "RTU", name: "Rooftop unit" },
    ]);
    expect(calls).toContainEqual({ table: "asset_types", method: "select", args: ["id, code, name"] });
    expect(calls).toContainEqual({ table: "asset_types", method: "order", args: ["name"] });
  });
});

describe("pipeline reader: the board rule for renewals (renewal door 7)", () => {
  const linked = (id: string, status: string, renews: string | null) => ({ ...agreement(id, status), renews_agreement_id: renews });

  test("C1206: an accepted agreement with an accepted or a draft renewal has no card", async () => {
    for (const renewal of ["accepted", "draft"]) {
      const cards = await board([linked("new", renewal, "old"), linked("old", "accepted", null)]);
      expect(cards.map((card) => card.id)).toEqual(["new"]);
    }
  });

  test("C1206: an accepted agreement whose only renewal is withdrawn keeps its card", async () => {
    const cards = await board([linked("new", "withdrawn", "old"), linked("old", "accepted", null)]);
    expect(cards.map((card) => card.id)).toEqual(["old"]);
    expect(cards[0].isRenewal).toBe(false);
  });

  test("C1206: a renewal's card has isRenewal true, an unlinked one false", async () => {
    const cards = await board([linked("new", "draft", "old"), linked("solo", "sent", null)]);
    expect(cards.find((card) => card.id === "new")?.isRenewal).toBe(true);
    expect(cards.find((card) => card.id === "solo")?.isRenewal).toBe(false);
  });
});

describe("pipeline reader: Expiring soon (renewal S6)", () => {
  const TODAY = "2027-12-01";
  const accepted = (id: string, termEnd: string | null, extra: { site?: string; notice?: number } = {}) => ({
    id,
    number: `AG-${id}`,
    site_id: extra.site ?? `site-${id}`,
    sites: { name: `Site ${id}`, customers: { name: `Customer ${id}` } },
    agreement_versions: [
      { version_no: 1, term_end: "2020-01-01", snapshot: {}, service_lines: [] },
      {
        version_no: 2,
        term_end: termEnd,
        snapshot: extra.notice === undefined ? {} : { terms: { renewalNoticeDays: extra.notice } },
        service_lines: [{ visits_per_year: 4, cost_per_visit_cents: 25000 }],
      },
    ],
  });

  async function expiring(rows: unknown[], renewals: unknown[] = [], open: unknown[] = []) {
    const { typed, calls } = stubClient({
      agreements: { sequence: [ok(rows), ok(renewals), ok(open)] },
      org_settings: ok({ renewal_notice_days: 30 }),
    });
    return { rows: await supabasePipelineReader(typed, fixedClock(NOW)).expiring(TODAY), calls };
  }

  test("C1209: accepted agreements ending from today to today + 90, earliest first, with every field", async () => {
    const { rows, calls } = await expiring([
      accepted("c", "2028-02-29"),
      accepted("x1", "2027-11-30"),
      accepted("a", "2027-12-01"),
      accepted("x2", "2028-03-01"),
      accepted("b", "2027-12-31", { notice: 16 }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(rows[1]).toEqual({
      id: "b",
      number: "AG-b",
      site: "Site b",
      customer: "Customer b",
      termEnd: "2027-12-31",
      noticeDate: "2027-12-15",
      annualCents: 100000,
      renewal: null,
      openAgreement: null,
    });
    expect(rows[0].noticeDate).toBe("2027-11-01");
    expect(calls).toContainEqual({ table: "agreements", method: "eq", args: ["status", "accepted"] });
  });

  test("C1209: a sent agreement ending in the window is left out", async () => {
    const { calls } = await expiring([accepted("a", "2027-12-31")]);
    const statusFilters = calls.filter((call) => call.table === "agreements" && call.method === "eq" && call.args[0] === "status");
    expect(statusFilters).toEqual([{ table: "agreements", method: "eq", args: ["status", "accepted"] }]);
  });

  test("C1209: a row carries its renewal's number and status", async () => {
    const { rows } = await expiring([accepted("a", "2027-12-31")], [{ id: "r", number: "AG-1013", status: "draft", renews_agreement_id: "a" }]);
    expect(rows[0].renewal).toEqual({ id: "r", number: "AG-1013", status: "draft" });
  });

  test("C1211: a row with no renewal carries the open agreement on its site", async () => {
    const { rows, calls } = await expiring(
      [accepted("a", "2027-12-31", { site: "s1", notice: 41 })],
      [],
      [{ number: "AG-1009", site_id: "s1", status: "sent" }],
    );
    expect(rows[0].openAgreement).toBe("AG-1009");
    expect(calls).toContainEqual({ table: "agreements", method: "in", args: ["status", ["draft", "sent", "changes_requested"]] });
    expect(calls).toContainEqual({ table: "agreements", method: "in", args: ["site_id", ["s1"]] });
  });
});

describe("pipeline reader: the agreement's status on its card (proposal-expiry S7)", () => {
  test("C1262: an expired agreement's card carries status expired", async () => {
    const cards = await board([{ ...agreement("gone", "expired"), renews_agreement_id: null }]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: "gone", stage: "refused", status: "expired" });
  });
});

describe("agreement lister (agreements-page)", () => {
  const TODAY = "2026-11-03";
  const SITE_ID = "00000000-0000-4000-8000-0000000000aa";
  type ListVersion = { version_no: number; term_end: string | null; contracts: { status: string }[]; service_lines: Line[] };
  const version = (version_no: number, term_end: string | null, contract?: string): ListVersion => ({
    version_no,
    term_end,
    contracts: contract ? [{ status: contract }] : [],
    service_lines: [{ visits_per_year: 4, cost_per_visit_cents: 100000 }],
  });
  function row(id: string, status: string, patch: { updated_at?: string; versions?: ListVersion[]; site_id?: string } = {}) {
    return {
      id,
      number: `AG-${id}`,
      status,
      updated_at: patch.updated_at ?? "2026-10-20T00:00:00Z",
      site_id: patch.site_id ?? ID,
      sites: { name: `Site ${id}`, customers: { name: `Customer ${id}` } },
      agreement_versions: patch.versions ?? [version(1, null)],
    };
  }
  async function list(rows: unknown[], filter = {}) {
    const { typed, calls } = stubClient({ agreements: ok(rows) });
    return { rows: await supabaseAgreementLister(typed).list(filter, TODAY), calls };
  }
  const EIGHT = [
    row("d", "draft", { updated_at: "2026-10-01T00:00:00Z" }),
    row("c", "changes_requested", { updated_at: "2026-10-02T00:00:00Z" }),
    row("s", "sent", { updated_at: "2026-10-03T00:00:00Z" }),
    row("a", "accepted", { updated_at: "2026-10-04T00:00:00Z" }),
    row("k", "accepted", { updated_at: "2026-10-05T00:00:00Z", versions: [version(1, null, "completed")] }),
    row("r", "refused", { updated_at: "2026-10-06T00:00:00Z" }),
    row("e", "expired", { updated_at: "2026-10-07T00:00:00Z" }),
    row("w", "withdrawn", { updated_at: "2026-10-08T00:00:00Z" }),
  ];

  test("C1349: every status is listed, newest change first, with the row fields", async () => {
    const { rows, calls } = await list(EIGHT);
    expect(rows.map((r) => r.id)).toEqual(["w", "e", "r", "k", "a", "s", "c", "d"]);
    expect(rows.find((r) => r.id === "w")).toEqual({
      id: "w",
      number: "AG-w",
      status: "withdrawn",
      site: "Site w",
      customer: "Customer w",
      versionNo: 1,
      annualCents: 400000,
      updatedAt: "2026-10-08T00:00:00Z",
      termEnd: null,
    });
    expect(calls.some((c) => c.method === "order" && c.args[0] === "updated_at")).toBe(true);
  });

  test("C1349: the latest version supplies the number, total and term end; a version with no lines has no total", async () => {
    const { rows } = await list([
      row("a", "accepted", { versions: [version(1, "2027-01-01"), { ...version(2, "2027-06-30"), service_lines: [] }] }),
    ]);
    expect(rows[0]).toMatchObject({ versionNo: 2, annualCents: null, termEnd: "2027-06-30" });
  });

  test("C1350: a site filter asks the database for that site only", async () => {
    const { calls } = await list([], { siteId: SITE_ID });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "site_id" && c.args[1] === SITE_ID)).toBe(true);
    expect((await list([], { siteId: SITE_ID })).rows).toEqual([]);
    const mixed = await list([row("mine", "sent", { site_id: SITE_ID }), row("other", "sent")], { siteId: SITE_ID });
    expect(mixed.rows.map((r) => r.id)).toEqual(["mine"]);
  });

  test("C1351: expiring keeps accepted agreements ending from today to today + 90 days", async () => {
    const accepted = (id: string, end: string | null) => row(id, "accepted", { versions: [version(1, end)] });
    const { rows } = await list(
      [
        accepted("today", "2026-11-03"),
        accepted("last", "2027-02-01"),
        accepted("past", "2026-11-02"),
        accepted("late", "2027-02-02"),
        accepted("none", null),
        row("sent", "sent", { versions: [version(1, "2026-12-01")] }),
        row("old", "accepted", { versions: [version(1, "2026-12-01"), version(2, "2028-01-01")] }),
      ],
      { expiring: true },
    );
    expect(rows.map((r) => r.id).sort()).toEqual(["last", "today"]);
    expect(rows.find((r) => r.id === "today")?.termEnd).toBe("2026-11-03");
  });

  test("C1352: every given filter applies", async () => {
    const { rows } = await list(
      [
        row("hit", "accepted", { site_id: SITE_ID, versions: [version(1, "2026-12-01")] }),
        row("wrong-status", "sent", { site_id: SITE_ID, versions: [version(1, "2026-12-01")] }),
        row("wrong-site", "accepted", { versions: [version(1, "2026-12-01")] }),
        row("wrong-date", "accepted", { site_id: SITE_ID, versions: [version(1, "2030-12-01")] }),
      ],
      { status: "accepted", siteId: SITE_ID, expiring: true },
    );
    expect(rows.map((r) => r.id)).toEqual(["hit"]);
  });

  test("C1352: the status filter keeps what matchesStatusFilter keeps, contract included", async () => {
    const { rows } = await list(EIGHT, { status: "completed" });
    expect(rows.map((r) => r.id)).toEqual(["k"]);
  });
});

describe("site lister (agreements-page)", () => {
  test("C1361: active sites come with their customer and live agreement; expired and refused are not live", async () => {
    const site = (id: string, agreements: { id: string; number: string; status: string }[], deactivated_at: string | null = null) => ({
      id,
      name: `Site ${id}`,
      deactivated_at,
      customers: { id: `cust-${id}`, name: `Customer ${id}`, deactivated_at: null },
      agreements,
    });
    const { typed, calls } = stubClient({
      sites: ok([
        site("free", []),
        site("busy", [{ id: "x1", number: "AG-1001", status: "sent" }]),
        site("past", [
          { id: "x2", number: "AG-1002", status: "expired" },
          { id: "x3", number: "AG-1003", status: "refused" },
        ]),
        site("off", [], "2026-10-01T00:00:00Z"),
      ]),
    });
    const options = await supabaseSiteLister(typed).listActive();
    expect(options.map((o) => o.id)).toEqual(["busy", "free", "past"]);
    expect(options.find((o) => o.id === "busy")).toEqual({
      id: "busy",
      name: "Site busy",
      customerId: "cust-busy",
      customer: "Customer busy",
      liveAgreement: { id: "x1", number: "AG-1001" },
    });
    expect(options.find((o) => o.id === "free")?.liveAgreement).toBeNull();
    expect(options.find((o) => o.id === "past")?.liveAgreement).toBeNull();
    expect(calls.some((c) => c.method === "is" && c.args[0] === "deactivated_at")).toBe(true);
  });
});

describe("site directory (sites-page)", () => {
  type AssetRow = { deactivated_at: string | null; asset_types: { code: string } };
  const asset = (code: string, off = false): AssetRow => ({ deactivated_at: off ? "2026-10-01T00:00:00Z" : null, asset_types: { code } });
  const siteRow = (
    id: string,
    patch: {
      name?: string;
      address?: string | null;
      customer?: string;
      customerId?: string;
      off?: boolean;
      customerOff?: boolean;
      assets?: AssetRow[];
      agreements?: { id: string; number: string; status: string }[];
    } = {},
  ) => ({
    id,
    name: patch.name ?? `Site ${id}`,
    address: patch.address === undefined ? `${id} Main St` : patch.address,
    customer_id: patch.customerId ?? `cust-${patch.customer ?? "A"}`,
    deactivated_at: patch.off ? "2026-10-01T00:00:00Z" : null,
    customers: { id: patch.customerId ?? `cust-${patch.customer ?? "A"}`, name: patch.customer ?? "A", deactivated_at: patch.customerOff ? "2026-10-01T00:00:00Z" : null },
    assets: patch.assets ?? [],
    agreements: patch.agreements ?? [],
  });
  const list = async (rows: unknown[], filter: Parameters<ReturnType<typeof supabaseSiteDirectory>["list"]>[0] = {}) => {
    const { typed, calls } = stubClient({ sites: ok(rows) });
    return { rows: await supabaseSiteDirectory(typed).list(filter), calls };
  };
  // The four fixture sites of the checks, deliberately out of order.
  const fixture = () => [
    siteRow("tower", { name: "Tower", customer: "Zed", assets: [asset("RTU")] }),
    siteRow("plain", { name: "Annex", customer: "Alpha" }),
    siteRow("gone", { name: "Old", customer: "Alpha", off: true }),
    siteRow("orphan", { name: "Shed", customer: "Beta", customerOff: true }),
  ];

  test("C1368: only active sites of active customers, by customer then site name, with every field", async () => {
    const { rows } = await list(fixture());
    expect(rows.map((r) => r.id)).toEqual(["plain", "tower"]);
    expect(rows[1]).toEqual({
      id: "tower",
      name: "Tower",
      address: "tower Main St",
      customerId: "cust-Zed",
      customer: "Zed",
      active: true,
      assetCount: 1,
      equipment: [{ code: "RTU", count: 1 }],
      liveAgreement: null,
    });
    expect((await list([siteRow("n", { address: null })])).rows[0].address).toBeNull();
  });

  test("C1368: two sites of one customer are ordered by site name", async () => {
    const { rows } = await list([siteRow("b", { name: "Bravo" }), siteRow("a", { name: "alpha" })]);
    expect(rows.map((r) => r.name)).toEqual(["alpha", "Bravo"]);
  });

  test("C1369: counts and equipment cover active assets only, by count then code", async () => {
    const { rows } = await list([
      siteRow("s", { assets: [asset("RTU"), asset("RTU"), asset("RTU"), asset("BLR"), asset("RTU", true)] }),
      siteRow("t", { name: "Tie", customer: "B", assets: [asset("MUA"), asset("AHU")] }),
      siteRow("e", { name: "Empty", customer: "C" }),
    ]);
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by("s").assetCount).toBe(4);
    expect(by("s").equipment).toEqual([{ code: "RTU", count: 3 }, { code: "BLR", count: 1 }]);
    expect(by("t").equipment).toEqual([{ code: "AHU", count: 1 }, { code: "MUA", count: 1 }]);
    expect(by("e")).toMatchObject({ assetCount: 0, equipment: [] });
  });

  test.each([
    ["draft", true],
    ["sent", true],
    ["changes_requested", true],
    ["accepted", false],
    ["refused", false],
    ["expired", false],
    ["withdrawn", false],
  ])("C1370: a %s agreement is live: %s", async (status, live) => {
    const { rows } = await list([siteRow("s", { agreements: [{ id: "x1", number: "AG-1001", status }] })]);
    expect(rows[0].liveAgreement).toEqual(live ? { id: "x1", number: "AG-1001", status } : null);
  });

  test("C1371: the query is capped at 500 rows", async () => {
    const { calls } = await list([]);
    expect(calls.some((c) => c.method === "limit" && c.args[0] === 500)).toBe(true);
  });

  test("C1371: a Supabase error rejects instead of returning an empty list", async () => {
    const { typed } = stubClient({ sites: fail("42501") });
    await expect(supabaseSiteDirectory(typed).list({})).rejects.toThrow("Supabase error 42501");
  });

  test("C1378: only the customer's sites, asked of the database and re-checked, none for an unknown customer", async () => {
    const rows = [siteRow("a", { customer: "A" }), siteRow("b", { customer: "B" })];
    const result = await list(rows, { customerId: "cust-A" });
    expect(result.rows.map((r) => r.id)).toEqual(["a"]);
    expect(result.calls.some((c) => c.method === "eq" && c.args[0] === "customer_id" && c.args[1] === "cust-A")).toBe(true);
    expect((await list(rows, { customerId: "cust-none" })).rows).toEqual([]);
  });

  test("C1379: q matches site name, address or customer name, ignoring case, and survives a null address", async () => {
    const rows = [
      siteRow("n", { name: "Harbour Tower", customer: "X1", address: null }),
      siteRow("a", { name: "Annex", customer: "X2", address: "12 Maple Road" }),
      siteRow("c", { name: "Depot", customer: "Maple Leaf Strata", address: "9 Pine" }),
      siteRow("z", { name: "Other", customer: "X3", address: "1 Oak" }),
    ];
    expect((await list(rows, { q: "HARBOUR" })).rows.map((r) => r.id)).toEqual(["n"]);
    expect((await list(rows, { q: "maple" })).rows.map((r) => r.id).sort()).toEqual(["a", "c"]);
    expect((await list(rows, { q: "nothing" })).rows).toEqual([]);
  });

  test("C1380: both filters must hold", async () => {
    const rows = [
      siteRow("hit", { name: "Maple Court", customer: "A" }),
      siteRow("wrongCustomer", { name: "Maple Court", customer: "B" }),
      siteRow("wrongText", { name: "Pine Court", customer: "A" }),
    ];
    expect((await list(rows, { customerId: "cust-A", q: "maple" })).rows.map((r) => r.id)).toEqual(["hit"]);
  });

  test("C1381: showInactive lists all four with their active flag and still counts active assets only", async () => {
    const rows = fixture();
    rows[2] = siteRow("gone", { name: "Old", customer: "Alpha", off: true, assets: [asset("RTU"), asset("RTU", true)] });
    const { rows: out } = await list(rows, { showInactive: true });
    expect(out.map((r) => r.id)).toEqual(["plain", "gone", "orphan", "tower"]);
    expect(out.map((r) => r.active)).toEqual([true, false, false, true]);
    expect(out.find((r) => r.id === "gone")?.assetCount).toBe(1);
  });
});

describe("contact roles in readers", () => {
  const withRoles = () => ({
    ...siteWithAgreements(),
    billing_contact_id: "c-late",
    sites: siteWithAgreements().sites.map((site) => ({ ...site, approver_contact_id: site.id === "s-late" ? "c-late" : "c-early" })),
  });

  test("C1450: each contact carries the roles it holds, with the site name for approver and site", async () => {
    const detail = await supabaseCustomerDirectory(stubClient({ customers: ok(withRoles()) }).typed).detail(ID);
    const roles = Object.fromEntries((detail?.contacts ?? []).map((c) => [c.id, c.roles]));
    expect(roles["c-late"]).toEqual([{ kind: "billing" }, { kind: "approver", site: "Late site" }]);
    expect(roles["c-early"]).toEqual([{ kind: "site", site: "Late site" }]);
  });

  test("C1451: the site register returns the approver's id and name, both null when none", async () => {
    const row = {
      id: ID,
      name: "Site",
      address: null,
      customer_id: "cust",
      site_contact_id: "c1",
      approver_contact_id: "c2",
      customers: {
        name: "Customer",
        contacts: [
          { id: "c1", name: "Dana" },
          { id: "c2", name: "Avery" },
        ],
      },
      assets: [],
    };
    const withApprover = await supabaseSiteRegister(stubClient({ sites: ok(row) }).typed).get(ID);
    expect(withApprover).toMatchObject({ approverContactId: "c2", approverName: "Avery", contactName: "Dana" });
    const without = await supabaseSiteRegister(stubClient({ sites: ok({ ...row, approver_contact_id: null }) }).typed).get(ID);
    expect(without).toMatchObject({ approverContactId: null, approverName: null });
  });
});

describe("customers to contacts embeds", () => {
  const HINT = "contacts!contacts_customer_id_org_id_fkey(";

  test("every query that embeds a customer's contacts names the foreign key (customers also point at their billing contact)", async () => {
    const selects = async (table: string, reply: unknown, run: (typed: ReturnType<typeof stubClient>["typed"]) => Promise<unknown>) => {
      const { typed, calls } = stubClient({ [table]: ok(reply) });
      await run(typed);
      return String(calls.find((call) => call.method === "select")?.args[0]);
    };
    expect(await selects("customers", [], (typed) => supabaseCustomerDirectory(typed).list())).toContain(HINT);
    expect(await selects("customers", siteWithAgreements(), (typed) => supabaseCustomerDirectory(typed).detail(ID))).toContain(HINT);
    expect(
      await selects("sites", { id: ID, name: "S", address: null, customer_id: "c", site_contact_id: null, customers: { name: "C", contacts: [] }, assets: [] }, (typed) =>
        supabaseSiteRegister(typed).get(ID),
      ),
    ).toContain(HINT);
  });
});

describe("record search", () => {
  const hit = (kind: string, n: number, patch: Record<string, unknown> = {}) => ({
    kind,
    id: `${kind}-${n}`,
    title: `${kind} ${n}`,
    customer_name: `Customer ${n}`,
    site_id: kind === "customer" ? null : `site-${n}`,
    site_name: kind === "customer" ? null : `Site ${n}`,
    address: kind === "site" ? `${n} Main St` : null,
    type_name: kind === "asset" ? "Rooftop unit" : null,
    ...patch,
  });
  const search = async (rows: unknown, text = "q") => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(ok(rows) as never);
    return { client, results: await supabaseRecordSearch(typed).search(text) };
  };

  test("C1571: one rpc call to search_records with the text and a limit of 26", async () => {
    const { client } = await search([], "harb");
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("search_records", { p_query: "harb", p_limit: 26 });
  });

  test("C1572: rows are sorted into customers, sites and equipment by kind, keep their order, and map to camel-case fields", async () => {
    const { results } = await search([hit("asset", 1), hit("customer", 1), hit("site", 1), hit("customer", 2), hit("site", 2)]);
    expect(results.customers.hits).toEqual([
      { id: "customer-1", name: "customer 1" },
      { id: "customer-2", name: "customer 2" },
    ]);
    expect(results.sites.hits).toEqual([
      { id: "site-1", name: "site 1", customerName: "Customer 1", address: "1 Main St" },
      { id: "site-2", name: "site 2", customerName: "Customer 2", address: "2 Main St" },
    ]);
    expect(results.equipment.hits).toEqual([
      { id: "asset-1", siteId: "site-1", unitNo: "asset 1", typeName: "Rooftop unit", siteName: "Site 1", customerName: "Customer 1" },
    ]);
  });

  test("C1572: a site without an address maps to a null address", async () => {
    const { results } = await search([hit("site", 1, { address: null })]);
    expect(results.sites.hits[0].address).toBeNull();
  });

  test("C1573: 26 rows of a kind keep 25 and set more; exactly 25 keep 25 and do not; the other kinds are judged on their own rows", async () => {
    const many = (kind: string, count: number) => Array.from({ length: count }, (_, i) => hit(kind, i + 1));
    const over = await search([...many("customer", 26), ...many("site", 25), ...many("asset", 3)]);
    // The group cap is one less than the limit asked of the database, so a 26th row is how "more" is known.
    const asked = (over.client.rpc.mock.calls[0][1] as { p_limit: number }).p_limit;
    expect(over.results.customers.hits).toHaveLength(asked - 1);
    expect(over.results.customers.hits).toHaveLength(25);
    expect(over.results.customers.hits[24].id).toBe("customer-25");
    expect(over.results.customers.more).toBe(true);
    expect(over.results.sites.hits).toHaveLength(25);
    expect(over.results.sites.more).toBe(false);
    expect(over.results.equipment.hits).toHaveLength(3);
    expect(over.results.equipment.more).toBe(false);
  });

  test("C1574: an rpc error throws an Error that carries the Supabase code", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail("XX000") as never);
    await expect(supabaseRecordSearch(typed).search("q")).rejects.toThrow("XX000");
  });
});
