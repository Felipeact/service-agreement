import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookies = vi.fn(async () => ({ getAll: () => [], set: () => {} }));
const connection = vi.fn(async () => {});
const createClient = vi.fn(() => ({}));
const createServerClient = vi.fn(() => ({}));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("next/server", () => ({ connection }));
vi.mock("@supabase/supabase-js", async (importOriginal) => ({ ...(await importOriginal<typeof import("@supabase/supabase-js")>()), createClient }));
vi.mock("@supabase/ssr", async (importOriginal) => ({ ...(await importOriginal<typeof import("@supabase/ssr")>()), createServerClient }));

const { getBillingContainer } = await import("./index");

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_9" }), { status: 200 }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "APP_BASE_URL"]) vi.stubEnv(name, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const SELECTION = { plan: "team", trades: ["hvac"] };

describe("the billing container with Stripe configured", () => {
  test.each([
    { name: "STRIPE_SECRET_KEY is unset", key: undefined, base: "https://app.example.com" },
    { name: "STRIPE_SECRET_KEY is empty", key: "", base: "https://app.example.com" },
    { name: "APP_BASE_URL is unset", key: "sk_test_x", base: undefined },
    { name: "APP_BASE_URL is empty", key: "sk_test_x", base: "" },
  ])("C2507: when $name the answer is not_configured and fetch is never called", async ({ key, base }) => {
    if (key === undefined) vi.stubEnv("STRIPE_SECRET_KEY", undefined as unknown as string);
    else vi.stubEnv("STRIPE_SECRET_KEY", key);
    if (base === undefined) vi.stubEnv("APP_BASE_URL", undefined as unknown as string);
    else vi.stubEnv("APP_BASE_URL", base);
    const { startTrial } = await getBillingContainer();
    expect(await startTrial(SELECTION)).toEqual({ status: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C2512: with both set a valid selection reaches Stripe once and redirects, touching no cookie, connection or Supabase client", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("APP_BASE_URL", "https://app.example.com");
    const { startTrial } = await getBillingContainer();
    expect(await startTrial(SELECTION)).toEqual({ status: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_9" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(cookies).not.toHaveBeenCalled();
    expect(connection).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
