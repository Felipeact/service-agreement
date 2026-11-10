import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const get = vi.fn(async () => ({ customerId: "cus_1", subscriptionId: "sub_1", plan: "team" as const }));
vi.mock("@/infrastructure/supabase/org-billing", () => ({ supabaseOrgBilling: () => ({ get }) }));

const subscription = { id: "sub_1", status: "active", trial_end: null, cancel_at_period_end: false, cancel_at: null, items: { data: [{ current_period_end: 1795547955 }] }, default_payment_method: null };
const fetchMock = vi.fn(async (url: string) => {
  const path = new URL(url).pathname;
  if (path.startsWith("/v1/subscriptions/")) return new Response(JSON.stringify(subscription), { status: 200 });
  if (path.startsWith("/v1/customers/")) return new Response(JSON.stringify({ id: "cus_1", invoice_settings: { default_payment_method: null } }), { status: 200 });
  return new Response(JSON.stringify({ data: [] }), { status: 200 });
});

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

describe("the container's billing page", () => {
  test.each([
    ["no secret key", { STRIPE_SECRET_KEY: "", APP_BASE_URL: "https://app.example.com" }],
    ["no base url", { STRIPE_SECRET_KEY: "sk_test_x", APP_BASE_URL: "" }],
    ["neither", { STRIPE_SECRET_KEY: "", APP_BASE_URL: "" }],
  ])("C3130: with %s the page is not configured and no Stripe request is made", async (_name, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(await container.loadBilling({ orgId: "org-1", role: "owner" })).toEqual({ kind: "not_configured" });
    expect(await container.startCardUpdate({ orgId: "org-1", role: "owner" })).toEqual({ ok: false, code: "not_configured" });
    expect(await container.cancelSubscription({ orgId: "org-1", role: "owner" })).toEqual({ ok: false, code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C3130: with both set the page reads the three Stripe objects with the key, for the stored ids", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("APP_BASE_URL", "https://app.example.com");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    const state = await container.loadBilling({ orgId: "org-1", role: "owner" });
    expect(state.kind).toBe("ready");
    expect(get).toHaveBeenCalledWith("org-1");
    const urls = fetchMock.mock.calls.map(([url]) => new URL(url as string).pathname).sort();
    expect(urls).toEqual(["/v1/customers/cus_1", "/v1/invoices", "/v1/subscriptions/sub_1"]);
    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_x");
  });

  test.each([
    ["owner", true],
    ["estimator", false],
  ])("C3130: the Billing link for a %s is %s", async (role, shown) => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(await container.billingLink("org-1", role)).toBe(shown);
  });

  test("C3118: the publishable key is null when unset and the value when set", async () => {
    vi.stubEnv("STRIPE_PUBLISHABLE_KEY", "");
    const { getContainer } = await import("./index");
    expect((await getContainer()).stripePublishableKey).toBeNull();
    vi.stubEnv("STRIPE_PUBLISHABLE_KEY", "pk_test_abc");
    expect((await getContainer()).stripePublishableKey).toBe("pk_test_abc");
  });
});
