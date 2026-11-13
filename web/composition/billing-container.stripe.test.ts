import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookies = vi.fn(async () => ({ getAll: () => [], set: () => {} }));
const connection = vi.fn(async () => {});
const rpc = vi.fn<(name: string, args: object) => Promise<{ data: unknown; error: { code: string } | null }>>();
const createClient = vi.fn<(url: string, key: string, options?: object) => { rpc: typeof rpc }>(() => ({ rpc }));
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
  rpc.mockResolvedValue({ data: false, error: null });
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "APP_BASE_URL"]) vi.stubEnv(name, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const SELECTION = { plan: "team", trades: ["hvac"], seats: "8", email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199" };

describe("the billing container with Stripe configured", () => {
  test.each([
    { name: "STRIPE_SECRET_KEY is unset", key: undefined, base: "https://app.example.com" },
    { name: "STRIPE_SECRET_KEY is empty", key: "", base: "https://app.example.com" },
    { name: "APP_BASE_URL is unset", key: "sk_test_x", base: undefined },
    { name: "APP_BASE_URL is empty", key: "sk_test_x", base: "" },
  ])("C2623: C2507: when $name the answer is not_configured and fetch is never called", async ({ key, base }) => {
    if (key === undefined) vi.stubEnv("STRIPE_SECRET_KEY", undefined as unknown as string);
    else vi.stubEnv("STRIPE_SECRET_KEY", key);
    if (base === undefined) vi.stubEnv("APP_BASE_URL", undefined as unknown as string);
    else vi.stubEnv("APP_BASE_URL", base);
    const { startTrial } = await getBillingContainer();
    expect(await startTrial(SELECTION)).toEqual({ status: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // C2512 amended by checkout-email-in-use (checks.md Deviations): a configured Stripe now asks the database first, so the anon
  // client is expected; the cookie and connection assertions, and the one Stripe call, are unchanged.
  test("C2623: C2512: with both set a valid selection reaches Stripe once and redirects, touching no cookie or connection", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("APP_BASE_URL", "https://app.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    const { startTrial } = await getBillingContainer();
    expect(await startTrial(SELECTION)).toEqual({ status: "redirect", url: "https://checkout.stripe.com/c/pay/cs_test_9" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(cookies).not.toHaveBeenCalled();
    expect(connection).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});

describe("the billing container asks whether the email is taken (checkout-email-in-use)", () => {
  const configure = () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("APP_BASE_URL", "https://app.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
  };

  test("C4314: a free email makes one anon client from the publishable key, one email_has_workspace call, then one Stripe request", async () => {
    configure();
    const { startTrial } = await getBillingContainer();
    expect((await startTrial(SELECTION)).status).toBe("redirect");
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0].slice(0, 2)).toEqual(["https://db.example.com", "sb_publishable_x"]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "email_has_workspace", { p_email: "owner@shop.ca" });
    expect(rpc).toHaveBeenNthCalledWith(2, "company_has_workspace", { p_name: "Shop Ltd" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("C4314: a taken email answers email_in_use and makes no Stripe request", async () => {
    configure();
    rpc.mockResolvedValue({ data: true, error: null });
    const { startTrial } = await getBillingContainer();
    expect(await startTrial(SELECTION)).toEqual({ status: "email_in_use" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C4314: with Stripe configured but no Supabase variables the answer is unavailable and Stripe is not called", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("APP_BASE_URL", "https://app.example.com");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { startTrial } = await getBillingContainer();
    expect(await startTrial(SELECTION)).toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("C4314: with no environment at all the check is skipped: not_configured and no Supabase client", async () => {
    const { startTrial } = await getBillingContainer();
    expect(await startTrial(SELECTION)).toEqual({ status: "not_configured" });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
