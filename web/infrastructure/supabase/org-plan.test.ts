import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseOrgPlanRecorder } from "./org-plan";
import { stubClient } from "./stub-client";

afterEach(() => vi.restoreAllMocks());

describe("the plan recorder", () => {
  test("C3212: one rpc set_org_plan with the plan and the seat count", async () => {
    const { client, typed } = stubClient({});
    expect(await supabaseOrgPlanRecorder(typed).record("team", 5)).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("set_org_plan", { p_plan: "team", p_seats: 5 });
  });

  test.each([
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["22023", "unavailable"],
    ["XX000", "unavailable"],
  ] as const)("C3212: an error %s is %s, logged once with the code", async (code, outcome) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: null, error: { code, message: "secret body cus_1" } });
    expect(await supabaseOrgPlanRecorder(typed).record("team", 5)).toEqual({ ok: false, code: outcome });
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0].join(" "));
    expect(line).toContain(code);
    expect(line).not.toContain("secret body");
    expect(line).not.toContain("cus_1");
  });

  test("C3212: a thrown error is unavailable and logged once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockRejectedValue(new Error("network down cus_1"));
    expect(await supabaseOrgPlanRecorder(typed).record("team", 5)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0].join(" "))).not.toContain("cus_1");
  });
});
