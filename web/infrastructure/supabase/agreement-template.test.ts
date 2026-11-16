import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseAgreementStore } from "./agreements";
import { stubClient } from "./stub-client";

afterEach(() => vi.restoreAllMocks());

const AGR = "11111111-1111-4111-8111-111111111111";
const TEMPLATE = "22222222-2222-4222-8222-222222222222";

describe("agreement store: setTemplate", () => {
  test("C7107: it calls set_agreement_template with the two ids and nothing else", async () => {
    const stub = stubClient({});
    stub.client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await supabaseAgreementStore(stub.typed).setTemplate(AGR, TEMPLATE)).toEqual({ ok: true });
    expect(stub.client.rpc).toHaveBeenCalledTimes(1);
    expect(stub.client.rpc).toHaveBeenCalledWith("set_agreement_template", { p_agreement_id: AGR, p_template_version_id: TEMPLATE });
  });

  test.each([
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["P0001", "locked"],
    ["22023", "invalid_template"],
    ["XX000", "unavailable"],
  ])("C7107: SQLSTATE %s is %s", async (code, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stub = stubClient({});
    stub.client.rpc.mockResolvedValue({ data: null, error: { code, message: "x" } });
    expect(await supabaseAgreementStore(stub.typed).setTemplate(AGR, TEMPLATE)).toEqual({ ok: false, code: expected });
  });

  test("C7107: a thrown call is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stub = stubClient({});
    stub.client.rpc.mockRejectedValue(new Error("network down"));
    expect(await supabaseAgreementStore(stub.typed).setTemplate(AGR, TEMPLATE)).toEqual({ ok: false, code: "unavailable" });
  });
});
