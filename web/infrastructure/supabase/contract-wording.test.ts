import { afterEach, describe, expect, test, vi } from "vitest";
import { SYSTEM_CONTRACT_BODY } from "@/domain/contract";
import type { ContractLayoutBody } from "@/domain/contract";
import { supabaseContractWordingReader, supabaseContractWordingStore } from "./contract-wording";
import { stubClient, type Reply } from "./stub-client";

const V2: ContractLayoutBody = {
  schema: 2,
  doc: { title: "PREVENTIVE MAINTENANCE SERVICE AGREEMENT", showMeta: false, pageHeader: "every", pageFooter: "letterhead" },
  layout: [
    { kind: "section", key: "price" },
    { kind: "section", key: "signatures", options: { customerLabel: "Client", nameField: true } },
  ],
};
const SYSTEM_ROW = { id: "t-0", org_id: null, document_template_versions: [{ version_no: 1, body: SYSTEM_CONTRACT_BODY }] };
const OWN_ROW = { id: "t-1", org_id: "org-1", document_template_versions: [{ version_no: 3, body: V2 }] };

const fail = (code: string): Reply => ({ data: null, error: { code, message: `boom ${code}`, hint: null } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the contract wording reader", () => {
  test("C5559: it reads the org's own latest contract template body when it has one, whatever the order of the rows", async () => {
    for (const rows of [[SYSTEM_ROW, OWN_ROW], [OWN_ROW, SYSTEM_ROW]]) {
      const { client, calls, typed } = stubClient({ document_templates: { data: rows, error: null } });
      expect(await supabaseContractWordingReader(typed).read()).toEqual({ ok: true, body: V2, own: true });
      expect(calls.filter((call) => call.method === "eq").map((call) => call.args)).toEqual([["kind", "contract"]]);
      expect(calls.some((call) => call.method === "order" && call.args[0] === "version_no")).toBe(true);
      expect(client.rpc).not.toHaveBeenCalled();
    }
  });

  test("C5559: it reads the system body while the org has none", async () => {
    const { typed } = stubClient({ document_templates: { data: [SYSTEM_ROW], error: null } });
    expect(await supabaseContractWordingReader(typed).read()).toEqual({ ok: true, body: SYSTEM_CONTRACT_BODY, own: false });
  });

  test.each<[string, Reply]>([
    ["a failed read", fail("XX000")],
    ["no readable template at all", { data: [], error: null }],
    ["a body this product cannot read", { data: [{ ...OWN_ROW, document_template_versions: [{ version_no: 1, body: { schema: 2, doc: {}, layout: [] } }] }], error: null }],
  ])("C5559: %s is unavailable and logged, never other wording", async (_name, reply) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { typed } = stubClient({ document_templates: reply });
    expect(await supabaseContractWordingReader(typed).read()).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe("the contract wording store", () => {
  test("C5559: it calls save_contract_template with the body as the member and returns the template and version", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: [{ template_id: "t-1", version_no: 4 }], error: null });
    expect(await supabaseContractWordingStore(typed).save(V2)).toEqual({ ok: true, templateId: "t-1", versionNo: 4 });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("save_contract_template", { p_body: V2 });
  });

  test.each<[string, string]>([
    ["42501", "forbidden"],
    ["22023", "invalid"],
  ])("C5559: %s is %s", async (code, expected) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail(code));
    expect(await supabaseContractWordingStore(typed).save(V2)).toEqual({ ok: false, code: expected });
  });

  test.each<[string, () => unknown]>([
    ["any other code", () => fail("XX000") as unknown],
    ["no row coming back", () => ({ data: [], error: null })],
  ])("C5559: %s is unavailable, with the code logged", async (_name, reply) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(reply() as Reply);
    expect(await supabaseContractWordingStore(typed).save(V2)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledTimes(1);
  });

  test("C5559: the code of an unexpected failure is in the log, and a rejected call is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValueOnce(fail("XX000"));
    await supabaseContractWordingStore(typed).save(V2);
    expect(String(log.mock.calls[0][0])).toContain("XX000");
    client.rpc.mockRejectedValueOnce(new Error("network"));
    expect(await supabaseContractWordingStore(typed).save(V2)).toEqual({ ok: false, code: "unavailable" });
  });
});
