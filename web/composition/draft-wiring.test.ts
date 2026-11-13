import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

afterEach(() => vi.unstubAllEnvs());

const webRoot = path.resolve(__dirname, "..");

describe("the container's catalog draft", () => {
  test("C4129: the container exposes the draft and accept use cases, and next.config raises the Server Action body limit to 5mb", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.draftCatalog).toBe("function");
    expect(typeof container.acceptCatalogDraft).toBe("function");
    const config = readFileSync(path.join(webRoot, "next.config.ts"), "utf8");
    expect(config).toMatch(/serverActions:\s*\{\s*bodySizeLimit:\s*"5mb"/);
    const composition = readFileSync(path.join(webRoot, "composition", "index.ts"), "utf8");
    expect(composition).toMatch(/claudeCatalogDrafter\(\{ apiKey: process\.env\.ANTHROPIC_API_KEY \}\)/);
  });
});
