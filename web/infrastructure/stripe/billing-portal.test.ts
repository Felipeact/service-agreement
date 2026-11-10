import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STRIPE_VERSION } from "./checkout";
import { stripeBillingPortal } from "./billing-portal";

const KEY = "sk_test_unit_key_0000";
const BASE = "https://app.example.com";
const CUSTOMER = "cus_TestCustomer123";
const URL_OK = "https://billing.stripe.com/p/session/test_1";

type Call = { url: string; init: RequestInit };
let calls: Call[];
let fetchMock: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  calls = [];
  fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return reply(200, { id: "bps_1", url: URL_OK });
  });
  vi.stubGlobal("fetch", fetchMock);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  errorLog.mockRestore();
});

const open = (base = BASE) => stripeBillingPortal({ secretKey: KEY, appBaseUrl: base }).open({ customerId: CUSTOMER });

describe("the Stripe billing portal", () => {
  test("C2902: one POST to the portal sessions url with the bearer key, the pinned version and exactly customer and return_url", async () => {
    expect(await open()).toEqual({ ok: true, url: URL_OK });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe("https://api.stripe.com/v1/billing_portal/sessions");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(headers["Stripe-Version"]).toBe(STRIPE_VERSION);
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(calls[0].init.body as string);
    expect([...form.keys()].sort()).toEqual(["customer", "return_url"]);
    expect(form.get("customer")).toBe(CUSTOMER);
    expect(form.get("return_url")).toBe("https://app.example.com/settings");
    expect(calls[0].url).not.toContain(KEY);
    expect(calls[0].init.body as string).not.toContain(KEY);
    expect(Object.entries(headers).filter(([name, value]) => name !== "Authorization" && value.includes(KEY))).toEqual([]);
  });

  test("C2902: a trailing slash on the base url is removed", async () => {
    await open("https://app.example.com///");
    expect(new URLSearchParams(calls[0].init.body as string).get("return_url")).toBe("https://app.example.com/settings");
  });

  test.each([
    ["200 with no url", () => reply(200, { id: "bps_1" })],
    ["200 with an empty url", () => reply(200, { url: "" })],
    ["200 with a non-string url", () => reply(200, { url: 42 })],
    ["200 with a body that is not JSON", () => new Response("<html>", { status: 200 })],
    ["400", () => reply(400, { error: { code: "invalid_request_error", message: "No configuration" } })],
    ["401", () => reply(401, { error: { code: "api_key_expired" } })],
    ["429", () => reply(429, { error: { code: "rate_limit" } })],
    ["500", () => reply(500, { error: { code: "api_error" } })],
  ])("C2906: %s is unavailable", async (_name, make) => {
    fetchMock.mockImplementation(async () => make());
    expect(await open()).toEqual({ ok: false, code: "unavailable" });
  });

  test("C2910: a 500 logs one line with the status and Stripe's error code and nothing else", async () => {
    fetchMock.mockImplementation(async () => reply(500, { error: { code: "api_error", message: `secret ${CUSTOMER} ${KEY}` }, customer: CUSTOMER }));
    const result = await open();
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const line = String(errorLog.mock.calls[0].join(" "));
    expect(line).toContain("500");
    expect(line).toContain("api_error");
    for (const secret of [CUSTOMER, KEY, "secret"]) {
      expect(line).not.toContain(secret);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  test("C2910: a refused connection logs one line without the customer id or key", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError(`fetch failed for ${CUSTOMER} with ${KEY}`);
    });
    expect(await open()).toEqual({ ok: false, code: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const line = String(errorLog.mock.calls[0].join(" "));
    expect(line).not.toContain(CUSTOMER);
    expect(line).not.toContain(KEY);
  });

  test("C2910: a request still open after 10 s is aborted, unavailable, and logged once", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = open();
    await vi.advanceTimersByTimeAsync(9_999);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: false, code: "unavailable" });
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0].join(" "))).not.toContain(CUSTOMER);
  });
});
