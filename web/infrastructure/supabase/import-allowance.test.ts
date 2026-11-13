import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseImportAllowance } from "./import-allowance";
import { stubClient, type Reply } from "./stub-client";

const JOB = "66666666-6666-4666-8666-666666666666";

afterEach(() => vi.restoreAllMocks());

function allowanceWith(reply: Reply) {
  const stub = stubClient({});
  stub.client.rpc.mockResolvedValue(reply);
  return { ...stub, allowance: supabaseImportAllowance(stub.typed) };
}

describe("the import allowance adapter", () => {
  test("C5130: an allowed row is allowed, calling import_allowance with the job id", async () => {
    const { allowance, client } = allowanceWith({ data: { plan: "starter", used: 3, limit: 10, allowed: true, resets_on: "2026-12-01" }, error: null });
    expect(await allowance.check(JOB)).toEqual({ ok: true, allowed: true });
    expect(client.rpc).toHaveBeenCalledWith("import_allowance", { p_job_id: JOB });
  });

  test("C5130: a refused row carries the plan, the limit, the use and the reset date", async () => {
    const { allowance } = allowanceWith({ data: { plan: "starter", used: 10, limit: 10, allowed: false, resets_on: "2026-12-01" }, error: null });
    expect(await allowance.check(JOB)).toEqual({ ok: true, allowed: false, plan: "starter", limit: 10, used: 10, resetsOn: "2026-12-01" });
  });

  test("C5130: the limit and the use are not swapped when they differ", async () => {
    const { allowance } = allowanceWith({ data: { plan: "team", used: 42, limit: 40, allowed: false, resets_on: "2027-01-01" }, error: null });
    expect(await allowance.check(JOB)).toEqual({ ok: true, allowed: false, plan: "team", limit: 40, used: 42, resetsOn: "2027-01-01" });
  });

  test.each([
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["XX000", "unavailable"],
  ] as const)("C5130: an rpc error %s is %s", async (code, outcome) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { allowance } = allowanceWith({ data: null, error: { code, message: "boom" } });
    expect(await allowance.check(JOB)).toEqual({ ok: false, code: outcome });
  });

  test("C5130: a thrown error, and an answer that is not a row, are unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = stubClient({});
    thrown.client.rpc.mockRejectedValue(new Error("network down"));
    expect(await supabaseImportAllowance(thrown.typed).check(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(await allowanceWith({ data: "nonsense", error: null }).allowance.check(JOB)).toEqual({ ok: false, code: "unavailable" });
  });
});
