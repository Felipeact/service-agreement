import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));

afterEach(() => vi.unstubAllEnvs());

describe("composition root: catalog draft", () => {
  test("C3438: the container drafts through the Claude drafter and the importer's parser, and without a key answers unavailable", async () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    expect(source).toMatch(/draftCatalog: makeDraftCatalog\(\{ parser: importParser, drafter: claudeCatalogDrafter\(\{ apiKey: process\.env\.ANTHROPIC_API_KEY \}\) \}\)/);
    expect(source).toContain("catalogDraftAllowed: setup.draftAllowed");
    expect(source).toContain("addCatalogTypes: setup.addTypes");

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    delete process.env.ANTHROPIC_API_KEY;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.draftCatalog).toBe("function");
    expect(typeof container.catalogDraftAllowed).toBe("function");
    expect(typeof container.addCatalogTypes).toBe("function");
    expect(await container.draftCatalog({ description: "pools" })).toEqual({ ok: false, error: "unavailable" });
  });
});
