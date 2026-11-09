import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const get = vi.fn(async (orgId: string) => (orgId === "org-1" ? { itemSingular: "station", itemPlural: "stations" } : null));
vi.mock("@/infrastructure/supabase/settings", () => ({ supabaseOrgSettingsStore: () => ({ get, save: vi.fn() }) }));

afterEach(() => vi.unstubAllEnvs());

describe("the container's item words", () => {
  test("C2011: getItemWords reads the settings store for that org and speaks its words", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect((await container.getItemWords("org-1")).Plural).toBe("Stations");
    expect(get).toHaveBeenCalledWith("org-1");
    expect((await container.getItemWords("org-2")).plural).toBe("equipment");
  });
});
