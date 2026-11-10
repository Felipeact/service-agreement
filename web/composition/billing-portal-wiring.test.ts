import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const get = vi.fn(async () => ({ customerId: "cus_1", plan: "team" as const }));
vi.mock("@/infrastructure/supabase/org-billing", () => ({ supabaseOrgBilling: () => ({ get }) }));

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "https://billing.stripe.com/p/session/x" }), { status: 200 }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  get.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const webRoot = path.resolve(__dirname, "..");

describe("the container's billing portal", () => {
  test.each([
    ["no secret key", { STRIPE_SECRET_KEY: "", APP_BASE_URL: "https://app.example.com" }],
    ["no base url", { STRIPE_SECRET_KEY: "sk_test_x", APP_BASE_URL: "" }],
    ["neither", { STRIPE_SECRET_KEY: "", APP_BASE_URL: "" }],
  ])("C2909: with %s the section is unavailable and opening answers not_configured with no fetch", async (_name, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(await container.billingSection("org-1", "owner")).toEqual({ kind: "unavailable", planName: "Team" });
    expect(await container.openBillingPortal({ orgId: "org-1", role: "owner" })).toEqual({ ok: false, code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C2909: with both set the section is ready and opening makes one Stripe request built from them", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("APP_BASE_URL", "https://app.example.com");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(await container.billingSection("org-1", "owner")).toEqual({ kind: "ready", planName: "Team" });
    expect(await container.openBillingPortal({ orgId: "org-1", role: "owner" })).toEqual({ ok: true, url: "https://billing.stripe.com/p/session/x" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/billing_portal/sessions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_x");
    expect(new URLSearchParams(init.body as string).get("return_url")).toBe("https://app.example.com/settings");
  });

  test("C2914: the Settings page reads the section from the container and its action uses the container's portal", () => {
    const page = readFileSync(path.join(webRoot, "app/(app)/settings/page.tsx"), "utf8");
    expect(page).toContain("billingSection");
    expect(page).toContain("getContainer");
    const action = readFileSync(path.join(webRoot, "app/(app)/settings/billing-actions.ts"), "utf8");
    expect(action).toContain("openBillingPortal");
    expect(action).toContain("getContainer");
    expect(action).not.toMatch(/STRIPE_SECRET_KEY|process\.env/);
  });
});
