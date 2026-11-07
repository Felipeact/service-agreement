import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseContractReader, supabaseContractStore } from "./contracts";
import { stubClient, type Reply } from "./stub-client";

const AGR = "11111111-1111-4111-8111-111111111111";
const CON = "66666666-6666-4666-8666-666666666666";

const fail = (code: string, hint: string | null = null): Reply => ({ data: null, error: { code, message: `boom ${code}`, hint } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("contract store", () => {
  test("C1619: it calls create_contract with the agreement id and returns the contract id", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: CON, error: null });
    expect(await supabaseContractStore(typed).create(AGR)).toEqual({ ok: true, id: CON });
    expect(client.rpc).toHaveBeenCalledWith("create_contract", { p_agreement_id: AGR });
  });

  test.each(["not_accepted", "auto_renewal", "site_inactive", "no_term_start", "no_signer"])("C1619: 55000 with the hint %s comes back as that code", async (hint) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail("55000", hint));
    expect(await supabaseContractStore(typed).create(AGR)).toEqual({ ok: false, code: hint });
  });

  test.each<[string, string, string]>([
    ["42501", "forbidden", "a viewer"],
    ["P0002", "not_found", "another org's agreement"],
  ])("C1619: %s is %s (%s)", async (code, expected) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail(code));
    expect(await supabaseContractStore(typed).create(AGR)).toEqual({ ok: false, code: expected });
  });

  test.each<[string, Reply]>([
    ["55000 with an unknown hint", fail("55000", "something_else")],
    ["55000 with no hint", fail("55000")],
    ["any other code", fail("XX000")],
  ])("C1619: %s is unavailable and logged once", async (_name, reply) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(reply);
    expect(await supabaseContractStore(typed).create(AGR)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledTimes(1);
  });

  test("C1619: a rejected call is unavailable and logged once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockRejectedValue(new Error("network down"));
    expect(await supabaseContractStore(typed).create(AGR)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledTimes(1);
  });

  test("C1619: a success that returns no id is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await supabaseContractStore(typed).create(AGR)).toEqual({ ok: false, code: "unavailable" });
  });
});

const PARTIES = {
  schema: 1,
  contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100" },
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
  signer: { name: "Pat Lee", email: "pat@example.com" },
};

const row = (over: Record<string, unknown> = {}) => ({
  id: CON,
  status: "pending_signature",
  created_at: "2026-11-05T18:00:00Z",
  parties: PARTIES,
  agreement_versions: { version_no: 2, agreement_id: AGR, agreements: { number: "AG-1052" } },
  ...over,
});

describe("contract reader", () => {
  test("C1629: a contract of the member's org comes back as a view", async () => {
    const { typed, calls } = stubClient({ contracts: { data: row(), error: null } });
    const view = await supabaseContractReader(typed).get(CON);
    expect(view).toEqual({
      id: CON,
      status: "pending_signature",
      agreementId: AGR,
      versionNo: 2,
      number: "AG-1052",
      createdAt: new Date("2026-11-05T18:00:00Z"),
      parties: {
        contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100" },
        customer: { name: "Fernwood Dental" },
        site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
        signer: { name: "Pat Lee", email: "pat@example.com" },
      },
    });
    expect(calls).toContainEqual({ table: "contracts", method: "eq", args: ["id", CON] });
  });

  test("C1629: stored parties of {} are null", async () => {
    const { typed } = stubClient({ contracts: { data: row({ parties: {} }), error: null } });
    expect((await supabaseContractReader(typed).get(CON))?.parties).toBeNull();
  });

  test("C1629: a malformed id is null without a query, and no row is null", async () => {
    const malformed = stubClient({});
    expect(await supabaseContractReader(malformed.typed).get("abc")).toBeNull();
    expect(malformed.calls).toHaveLength(0);
    expect(await supabaseContractReader(stubClient({ contracts: { data: null, error: null } }).typed).get(CON)).toBeNull();
  });

  test("C1629: a read error is thrown, not hidden as a missing contract", async () => {
    const { typed } = stubClient({ contracts: fail("XX000") });
    await expect(supabaseContractReader(typed).get(CON)).rejects.toThrow("XX000");
  });
});

describe("contract reader: signature requests", () => {
  const request = (id: string, status: string, createdAt: string) => ({ id, status, created_at: createdAt });

  test("C1690: a contract with no request has signing null", async () => {
    const { typed } = stubClient({ contracts: { data: row({ contract_signature_requests: [] }), error: null } });
    expect((await supabaseContractReader(typed).get(CON))?.signing).toBeNull();
  });

  test("C1690: the newest request is the one the view carries, whatever order the rows come in", async () => {
    const rows = [request("old", "failed", "2026-11-05T10:00:00Z"), request("new", "open", "2026-11-06T10:00:00Z"), request("mid", "voided", "2026-11-05T20:00:00Z")];
    const { typed } = stubClient({ contracts: { data: row({ contract_signature_requests: rows }), error: null } });
    expect((await supabaseContractReader(typed).get(CON))?.signing).toEqual({ requestId: "new", status: "open" });
  });

  test("C1690: the read asks for the requests of the contract", async () => {
    const { typed, calls } = stubClient({ contracts: { data: row({ contract_signature_requests: [] }), error: null } });
    await supabaseContractReader(typed).get(CON);
    expect(String(calls.find((call) => call.method === "select")?.args[0])).toContain("contract_signature_requests(id, status, created_at)");
  });

  test.each([
    ["creating", true],
    ["open", true],
    ["failed", false],
    ["voided", false],
  ])("C1690: a %s request is live: %s", async (status, live) => {
    const { isLiveRequest } = await import("@/domain/contract");
    expect(isLiveRequest(status as "creating" | "open" | "failed" | "voided")).toBe(live);
  });
});
