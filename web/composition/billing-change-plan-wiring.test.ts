import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const get = vi.fn(async () => ({ customerId: "cus_1", subscriptionId: "sub_1", plan: "starter" as const, seats: 2 }));
const record = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/infrastructure/supabase/org-billing", () => ({ supabaseOrgBilling: () => ({ get }) }));
vi.mock("@/infrastructure/supabase/org-plan", () => ({ supabaseOrgPlanRecorder: () => ({ record }) }));

const planItem = { id: "si_plan", quantity: 1, current_period_end: 1795547955, price: { product: { id: "prod_old", metadata: { sa_kind: "plan", sa_plan: "starter" } } } };
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const { pathname } = new URL(url);
  if (pathname.startsWith("/v1/subscriptions/") && (init?.method ?? "GET") === "GET") return new Response(JSON.stringify({ id: "sub_1", status: "active", items: { data: [planItem] } }), { status: 200 });
  if (pathname.startsWith("/v1/products/")) return new Response(JSON.stringify({ id: "sa_plan_team" }), { status: 200 });
  return new Response(JSON.stringify({ id: "sub_1" }), { status: 200 });
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  get.mockClear();
  record.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the container's change-plan", () => {
  test.each([
    ["no secret key", { STRIPE_SECRET_KEY: "", APP_BASE_URL: "https://app.example.com" }],
    ["no base url", { STRIPE_SECRET_KEY: "sk_test_x", APP_BASE_URL: "" }],
    ["neither", { STRIPE_SECRET_KEY: "", APP_BASE_URL: "" }],
  ])("C3214: with %s a change answers not_configured, makes no Stripe request and records nothing", async (_name, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(await container.changePlan({ orgId: "org-1", role: "owner" }, "team")).toEqual({ ok: false, code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test("C3214: with both set a change reads and updates Stripe with the key and records the plan through the recorder", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("APP_BASE_URL", "https://app.example.com");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(await container.changePlan({ orgId: "org-1", role: "owner" }, "team")).toEqual({ ok: true });
    expect(get).toHaveBeenCalledWith("org-1");
    const posted = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(posted.map(([url]) => new URL(url as string).pathname)).toEqual(["/v1/subscriptions/sub_1"]);
    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_x");
    expect(record).toHaveBeenCalledWith("team", 5);
  });
});
