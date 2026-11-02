import { describe, expect, test } from "vitest";
import { fixedClock } from "@/infrastructure/clock";
import { supabaseAssetTypeCatalog, supabaseCustomerDirectory, supabasePipelineReader, supabaseSiteRegister } from "./readers";
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

function customerRow(id: string, name: string, patch: { contacts?: ContactRow[]; sites?: { assets: { count: number }[] }[] } = {}) {
  return { id, name, contacts: patch.contacts ?? [], sites: patch.sites ?? [] };
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
    const [customer] = await customers([customerRow("1", "A", { sites: [{ assets: [{ count: 3 }] }, { assets: [{ count: 4 }] }] })]);
    expect(customer).toMatchObject({ siteCount: 2, assetCount: 7 });
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
        assets: [{ count: 5 }],
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
      { id: "s-early", name: "Early site", address: "1 Main St", site_contact_id: null, created_at: "2026-01-01T00:00:00Z", assets: [], agreements: [] },
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
