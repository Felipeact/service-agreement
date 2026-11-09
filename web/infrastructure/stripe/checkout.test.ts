import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CheckoutSelection } from "@/domain/billing";
import { stripeCheckoutStarter } from "./checkout";

const KEY = "sk_test_unit_key_0000";
const BASE = "https://app.example.com";

const SELECTION: CheckoutSelection = { plan: "team", trades: ["hvac", "plumbing"] };

type Call = { url: string; init: RequestInit };
let calls: Call[];
let fetchMock: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  calls = [];
  fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return reply(200, { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  });
  vi.stubGlobal("fetch", fetchMock);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  errorLog.mockRestore();
});

const start = (selection: CheckoutSelection = SELECTION, base = BASE) => stripeCheckoutStarter({ secretKey: KEY, appBaseUrl: base }).start(selection);
const form = () => new URLSearchParams(calls[0].init.body as string);
const headers = () => calls[0].init.headers as Record<string, string>;

describe("the Stripe checkout starter", () => {
  test("C2500: one POST to the sessions url with the bearer key and a form-encoded string body, the key nowhere else", async () => {
    await start();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(calls[0].init.method).toBe("POST");
    expect(headers().Authorization).toBe(`Bearer ${KEY}`);
    expect(headers()["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(typeof calls[0].init.body).toBe("string");
    expect(calls[0].url).not.toContain(KEY);
    expect(calls[0].init.body as string).not.toContain(KEY);
    expect(Object.entries(headers()).filter(([name, value]) => name !== "Authorization" && value.includes(KEY))).toEqual([]);
  });

  const PLAN_CASES = [
    { plan: "starter", cents: "4900", name: "Starter plan" },
    { plan: "team", cents: "9900", name: "Team plan" },
    { plan: "business", cents: "19900", name: "Business plan" },
  ] as const;
  const TRADE_CASES = [["hvac"], ["hvac", "plumbing", "electrical", "other"]] as const;

  test.each(PLAN_CASES.flatMap((p) => TRADE_CASES.map((trades) => ({ ...p, trades }))))(
    "C2501: $plan with $trades.length trade(s) is priced in cad per month and named $name",
    async ({ plan, cents, name, trades }) => {
      await start({ plan, trades: [...trades] });
      const body = form();
      expect(body.get("mode")).toBe("subscription");
      expect(body.get("line_items[0][quantity]")).toBe("1");
      expect(body.get("line_items[0][price_data][currency]")).toBe("cad");
      expect(body.get("line_items[0][price_data][unit_amount]")).toBe(cents);
      expect(body.get("line_items[0][price_data][recurring][interval]")).toBe("month");
      expect(body.get("line_items[0][price_data][product_data][name]")).toBe(name);
    },
  );

  test.each(PLAN_CASES)("C2502: $plan asks for a 14-day trial, a card up front and cancellation without one", async ({ plan }) => {
    await start({ plan, trades: ["hvac"] });
    const body = form();
    expect(body.get("subscription_data[trial_period_days]")).toBe("14");
    expect(body.get("payment_method_collection")).toBe("always");
    expect(body.get("subscription_data[trial_settings][end_behavior][missing_payment_method]")).toBe("cancel");
  });

  test.each([
    { trades: ["other", "hvac"] as const, joined: "hvac,other" },
    { trades: ["hvac", "plumbing", "electrical", "other"] as const, joined: "hvac,plumbing,electrical,other" },
  ])("C2503: the plan and the trades ride on the session and the subscription, $joined", async ({ trades, joined }) => {
    await start({ plan: "business", trades: [...trades] });
    const body = form();
    expect(body.get("metadata[plan]")).toBe("business");
    expect(body.get("subscription_data[metadata][plan]")).toBe("business");
    expect(body.get("metadata[trades]")).toBe(joined);
    expect(body.get("subscription_data[metadata][trades]")).toBe(joined);
  });

  test.each(PLAN_CASES)("C2504: $plan returns to the success page and cancels back to /register?plan=$plan", async ({ plan }) => {
    await start({ plan, trades: ["hvac"] });
    expect(form().get("success_url")).toBe("https://app.example.com/register/success");
    expect(form().get("cancel_url")).toBe(`https://app.example.com/register?plan=${plan}`);
  });

  test("C2505: every request carries the same Stripe-Version that begins with a date", async () => {
    await start();
    await start({ plan: "starter", trades: ["other"] });
    const versions = calls.map((call) => (call.init.headers as Record<string, string>)["Stripe-Version"]);
    expect(versions[0]).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(versions[1]).toBe(versions[0]);
  });

  test("C2506: a 200 with a url answers ok with that exact url", async () => {
    expect(await start()).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  });

  const TIMEOUT = "no answer in 10 s";
  const FAILURES: { name: string; arrange: () => void }[] = [
    { name: "400", arrange: () => fetchMock.mockImplementation(async () => reply(400, { error: { code: "parameter_invalid_empty", message: "x" } })) },
    { name: "401", arrange: () => fetchMock.mockImplementation(async () => reply(401, { error: { code: "api_key_invalid" } })) },
    { name: "429", arrange: () => fetchMock.mockImplementation(async () => reply(429, { error: { code: "rate_limit" } })) },
    { name: "500", arrange: () => fetchMock.mockImplementation(async () => reply(500, {})) },
    { name: "200 with no url", arrange: () => fetchMock.mockImplementation(async () => reply(200, { id: "cs_test_2" })) },
    { name: "fetch rejects", arrange: () => fetchMock.mockImplementation(async () => Promise.reject(new TypeError("fetch failed"))) },
    {
      name: TIMEOUT,
      arrange: () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
            }),
        );
      },
    },
  ];

  test.each(FAILURES)("C2508: $name answers unavailable", async ({ name, arrange }) => {
    arrange();
    const pending = start();
    if (name === TIMEOUT) {
      await vi.advanceTimersByTimeAsync(9_999);
      expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    }
    expect(await pending).toEqual({ ok: false, code: "unavailable" });
  });

  const LOGGED: Record<string, string> = {
    "400": "400",
    "401": "401",
    "429": "429",
    "500": "500",
    "200 with no url": "200",
    "fetch rejects": "no answer",
    [TIMEOUT]: "no answer",
  };

  test.each(FAILURES)("C2509: $name logs once, with the status and code only", async ({ name, arrange }) => {
    arrange();
    const pending = start({ plan: "business", trades: ["electrical", "other"] }, "https://app.example.com");
    if (name === TIMEOUT) await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(errorLog).toHaveBeenCalledTimes(1);
    const line = String(errorLog.mock.calls[0].join(" "));
    for (const forbidden of [KEY, "business", "electrical", "other", "@", "https://", "cs_"]) expect(line).not.toContain(forbidden);
    expect(line).toContain(LOGGED[name]);
    if (name === "400") expect(line).toContain("parameter_invalid_empty");
  });
});
