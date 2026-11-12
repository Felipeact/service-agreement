import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseCatalogWriter } from "./catalog-writer";
import { stubClient } from "./stub-client";

afterEach(() => vi.restoreAllMocks());

const types = [{ name: "Termite inspection", months: [3, 9], tasks: ["Check bait stations"] }];

describe("the catalog writer", () => {
  test("C4124: one rpc add_catalog_draft with the org, trade and types, and the count comes back", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: 1, error: null });
    expect(await supabaseCatalogWriter(typed).add("org-1", "pest control", types)).toEqual({ ok: true, added: 1 });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("add_catalog_draft", { p_org_id: "org-1", p_trade: "pest control", p_types: types });
  });

  test.each([
    ["42501", "forbidden"],
    ["55000", "not_empty"],
    ["23514", "invalid"],
    ["XX000", "unavailable"],
  ] as const)("C4124: an error %s is %s, logged once with the code and not the draft", async (code, outcome) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: null, error: { code, message: "Termite inspection secret" } });
    expect(await supabaseCatalogWriter(typed).add("org-1", "pest control", types)).toEqual({ ok: false, code: outcome });
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0].join(" "));
    expect(line).toContain(code);
    expect(line).not.toContain("Termite");
  });

  test("C4124: a thrown error is unavailable and logged once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockRejectedValue(new Error("network down Termite"));
    expect(await supabaseCatalogWriter(typed).add("org-1", "pest control", types)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0].join(" "))).not.toContain("Termite");
  });
});
