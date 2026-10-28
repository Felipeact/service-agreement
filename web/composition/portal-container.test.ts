import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the composition root", () => {
  test("C930: it wires the customer side from the request's own client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.viewPortal).toBe("function");
    expect(typeof container.decidePortal).toBe("function");
    expect(typeof container.recordPortalView).toBe("function");
    expect(typeof container.documentRenderer.renderAgreement).toBe("function");
  });
});
