import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseAgreementScopeStore } from "./agreement-scope";
import { stubClient } from "./stub-client";

afterEach(() => vi.restoreAllMocks());

const AGR = "11111111-1111-4111-8111-111111111111";
const ASSET = "22222222-2222-4222-8222-222222222222";
const ok = (data: unknown) => ({ data, error: null });

describe("agreement scope store", () => {
  test("C6010: uncovered reads the draft-only list of the scope function", async () => {
    const stub = stubClient({});
    stub.client.rpc.mockResolvedValue(ok({ schema: 2, types: [], uncovered: [{ code: "BOILER", name: "Boiler", assetCount: 2 }] }));
    expect(await supabaseAgreementScopeStore(stub.typed).uncovered(AGR)).toEqual([{ code: "BOILER", name: "Boiler", assetCount: 2 }]);
    expect(stub.client.rpc).toHaveBeenCalledWith("agreement_service_scope", { p_agreement_id: AGR });
  });

  test("C6013: setExcluded resolves the current version, then calls the RPC with the asked flag", async () => {
    const stub = stubClient({ agreement_versions: ok([{ id: "v2" }]) });
    stub.client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await supabaseAgreementScopeStore(stub.typed).setExcluded(AGR, ASSET, true)).toEqual({ ok: true });
    expect(stub.client.rpc).toHaveBeenCalledWith("set_scope_exclusion", { p_version_id: "v2", p_asset_id: ASSET, p_excluded: true });
    expect(stub.calls).toContainEqual({ table: "agreement_versions", method: "order", args: ["version_no", { ascending: false }] });
  });

  test.each([
    ["42501", "forbidden"],
    ["P0001", "locked"],
    ["P0002", "not_found"],
    ["23514", "not_found"],
    ["XX000", "unavailable"],
  ])("C6007: SQLSTATE %s is %s", async (code, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stub = stubClient({ agreement_versions: ok([{ id: "v2" }]) });
    stub.client.rpc.mockResolvedValue({ data: null, error: { code, message: "x" } });
    expect(await supabaseAgreementScopeStore(stub.typed).setExcluded(AGR, ASSET, false)).toEqual({ ok: false, code: expected });
  });

  test("C6013: an agreement with no visible version is not_found and the RPC is never called", async () => {
    const stub = stubClient({ agreement_versions: ok([]) });
    expect(await supabaseAgreementScopeStore(stub.typed).setExcluded(AGR, ASSET, true)).toEqual({ ok: false, code: "not_found" });
    expect(stub.client.rpc).not.toHaveBeenCalled();
  });
});
