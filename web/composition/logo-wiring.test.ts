import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const options = vi.fn();
vi.mock("@/infrastructure/supabase/org-logo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/org-logo")>()),
  supabaseOrgLogo: (_client: unknown, given: unknown) => {
    options(given);
    return { current: async () => null, load: async () => null, prepareUpload: async () => ({ ok: false }), remove: async () => {}, url: () => null };
  },
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  options.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("getContainer's logo", () => {
  test("C3328: the logo adapter is built on the project URL, so a stored logo is read from the public bucket address", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(options).toHaveBeenCalledWith({ baseUrl: "https://example.supabase.co" });
    expect(container.logo).toBeDefined();
    expect(typeof container.tenantLogo).toBe("function");
  });
});
