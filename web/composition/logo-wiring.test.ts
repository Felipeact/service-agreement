import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const options = vi.fn();
const STORED = "org-1/33333333-3333-4333-8333-333333333333.png";
const LOGO = { bytes: new Uint8Array([1, 2, 3]), format: "png" as const };
const load = vi.fn(async (path: string | null) => (path === STORED ? LOGO : null));
vi.mock("@/infrastructure/supabase/org-logo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/org-logo")>()),
  supabaseOrgLogo: (_client: unknown, given: unknown) => {
    options(given);
    return { current: async (orgId: string) => (orgId === "org-1" ? STORED : null), load, prepareUpload: async () => ({ ok: false }), remove: async () => {}, url: () => null };
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

  test("C3330: the container's tenantLogo gives the logo of the org's stored path, and null for an org with none", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(await container.tenantLogo("org-1")).toEqual(LOGO);
    expect(load).toHaveBeenCalledWith(STORED);
    expect(await container.tenantLogo("org-2")).toBeNull();
  });
});
