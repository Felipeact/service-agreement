import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

afterEach(() => vi.unstubAllEnvs());

describe("the container's contract import", () => {
  test("C5817: the container exposes the import use case, built on the Claude splitter with the API key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { getContainer } = await import("./index");
    expect(typeof (await getContainer()).importContractWording).toBe("function");
    const composition = readFileSync(path.resolve(__dirname, "index.ts"), "utf8");
    expect(composition).toMatch(/claudeContractSplitter\(\{ apiKey: process\.env\.ANTHROPIC_API_KEY \}\)/);
  });
});
