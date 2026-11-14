import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseOrgUsage } from "./org-usage";
import { stubClient, type Reply } from "./stub-client";

afterEach(() => vi.restoreAllMocks());

function readerWith(reply: Reply) {
  const stub = stubClient({});
  stub.client.rpc.mockResolvedValue(reply);
  return { ...stub, reader: supabaseOrgUsage(stub.typed) };
}

describe("the usage adapter", () => {
  test("C5146: the rpc row becomes the usage of the plan", async () => {
    const { reader, client } = readerWith({
      data: { plan: "starter", live_agreements: { used: 7, limit: 15 }, ai_imports: { used: 3, limit: 10 }, resets_on: "2026-12-01" },
      error: null,
    });
    expect(await reader.read()).toEqual({ plan: "starter", liveAgreements: { used: 7, limit: 15 }, aiImports: { used: 3, limit: 10 }, resetsOn: "2026-12-01" });
    expect(client.rpc).toHaveBeenCalledWith("org_usage");
  });

  test("the month's tokens come with the imports when the database reports them, and are left out when it does not", async () => {
    const { reader } = readerWith({
      data: { plan: "starter", live_agreements: { used: 7, limit: 15 }, ai_imports: { used: 3, limit: 10, input_tokens: 21000, output_tokens: 30000 }, resets_on: "2026-12-01" },
      error: null,
    });
    expect(await reader.read()).toMatchObject({ aiTokens: { input: 21000, output: 30000 } });

    const { reader: older } = readerWith({
      data: { plan: "starter", live_agreements: { used: 7, limit: 15 }, ai_imports: { used: 3, limit: 10 }, resets_on: "2026-12-01" },
      error: null,
    });
    expect(await older.read()).not.toHaveProperty("aiTokens");
  });

  test("C5146: an org with no plan has null limits", async () => {
    const { reader } = readerWith({
      data: { plan: null, live_agreements: { used: 1, limit: null }, ai_imports: { used: 0, limit: null }, resets_on: "2026-12-01" },
      error: null,
    });
    expect(await reader.read()).toEqual({ plan: null, liveAgreements: { used: 1, limit: null }, aiImports: { used: 0, limit: null }, resetsOn: "2026-12-01" });
  });

  test.each(["42501", "XX000"])("C5146: an rpc error %s is null", async (code) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readerWith({ data: null, error: { code, message: "boom" } }).reader.read()).toBeNull();
  });

  test("C5146: a thrown error and a malformed row are null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = stubClient({});
    thrown.client.rpc.mockRejectedValue(new Error("down"));
    expect(await supabaseOrgUsage(thrown.typed).read()).toBeNull();
    expect(await readerWith({ data: { plan: "starter" }, error: null }).reader.read()).toBeNull();
  });
});
