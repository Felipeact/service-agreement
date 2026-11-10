import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STRIPE_VERSION } from "./http";
import { stripeBillingGateway } from "./billing-gateway";

const KEY = "sk_test_unit_key_0000";
const IDS = { customerId: "cus_TestCustomer1", subscriptionId: "sub_TestSub1" };
const PERIOD_END = 1795547955;
const TRIAL_END = 1795547955;

type Call = { url: URL; method: string; headers: Record<string, string>; body: string | null };
let calls: Call[];
let fetchMock: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;
type Handler = (call: Call) => Response | Promise<Response>;
let handler: Handler;

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const visa = { id: "pm_sub", card: { brand: "visa", last4: "4242", exp_month: 4, exp_year: 2030 } };
const mastercard = { id: "pm_cust", card: { brand: "mastercard", last4: "0005", exp_month: 12, exp_year: 2031 } };

const subscription = (over: Record<string, unknown> = {}) => ({
  id: IDS.subscriptionId,
  status: "trialing",
  trial_end: TRIAL_END,
  cancel_at_period_end: false,
  cancel_at: null,
  // A decoy: the pinned API version has no subscription-level period, only the item has one.
  current_period_end: 1,
  items: { data: [{ current_period_end: PERIOD_END }] },
  default_payment_method: visa,
  ...over,
});
const customer = (over: Record<string, unknown> = {}) => ({ id: IDS.customerId, invoice_settings: { default_payment_method: null }, ...over });
const invoices = (data: unknown[] = [{ id: "in_1", number: "INV-0001", created: 1790000000, total: 9900, currency: "cad", status: "paid", hosted_invoice_url: "https://invoice.stripe.com/i/x" }]) => ({ data });

/** The three reads and the writes, answered from `parts`; anything else is a 404. */
function stripe(parts: { sub?: () => Response; cust?: () => Response; inv?: () => Response; seti?: () => Response; write?: () => Response } = {}): Handler {
  return (call) => {
    const path = call.url.pathname;
    if (call.method === "GET" && path === `/v1/subscriptions/${IDS.subscriptionId}`) return (parts.sub ?? (() => reply(200, subscription())))();
    if (call.method === "GET" && path === `/v1/customers/${IDS.customerId}`) return (parts.cust ?? (() => reply(200, customer())))();
    if (call.method === "GET" && path === "/v1/invoices") return (parts.inv ?? (() => reply(200, invoices())))();
    if (call.method === "GET" && path.startsWith("/v1/setup_intents/")) return (parts.seti ?? (() => reply(200, { id: "seti_1", status: "succeeded", customer: IDS.customerId, payment_method: "pm_new" })))();
    if (call.method === "POST") return (parts.write ?? (() => reply(200, { id: "obj_1", client_secret: "seti_1_secret_abc" })))();
    return reply(404, { error: { code: "resource_missing" } });
  };
}

beforeEach(() => {
  calls = [];
  handler = stripe();
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const call: Call = { url: new URL(url), method: init.method ?? "GET", headers: (init.headers ?? {}) as Record<string, string>, body: typeof init.body === "string" ? init.body : null };
    calls.push(call);
    return handler(call);
  });
  vi.stubGlobal("fetch", fetchMock);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  errorLog.mockRestore();
});

const gateway = () => stripeBillingGateway({ secretKey: KEY });
const posts = () => calls.filter((call) => call.method === "POST");
const form = (call: Call) => new URLSearchParams(call.body ?? "");
const logged = () => errorLog.mock.calls.map((args: unknown[]) => args.join(" ")).join("\n");

describe("the overview reads", () => {
  test("C3105: exactly three GETs, each with the bearer key and the pinned version, the key nowhere else", async () => {
    await gateway().overview(IDS);
    expect(calls.map((call) => `${call.method} ${call.url.pathname}`).sort()).toEqual([
      `GET /v1/customers/${IDS.customerId}`,
      "GET /v1/invoices",
      `GET /v1/subscriptions/${IDS.subscriptionId}`,
    ]);
    const sub = calls.find((call) => call.url.pathname.includes("/subscriptions/"))!;
    expect(sub.url.searchParams.getAll("expand[]")).toEqual(["default_payment_method"]);
    const cust = calls.find((call) => call.url.pathname.includes("/customers/"))!;
    expect(cust.url.searchParams.getAll("expand[]")).toEqual(["invoice_settings.default_payment_method"]);
    const inv = calls.find((call) => call.url.pathname === "/v1/invoices")!;
    expect(inv.url.searchParams.get("customer")).toBe(IDS.customerId);
    expect(inv.url.searchParams.get("limit")).toBe("12");
    for (const call of calls) {
      expect(call.headers.Authorization).toBe(`Bearer ${KEY}`);
      expect(call.headers["Stripe-Version"]).toBe(STRIPE_VERSION);
      expect(call.body).toBeNull();
      expect(call.url.toString()).not.toContain(KEY);
      expect(Object.entries(call.headers).filter(([name, value]) => name !== "Authorization" && value.includes(KEY))).toEqual([]);
    }
  });

  test("C3106: the period end is the item's, the trial end, the card and the invoices are mapped", async () => {
    const result = await gateway().overview(IDS);
    expect(result).toEqual({
      ok: true,
      overview: {
        status: "trialing",
        trialEnd: TRIAL_END,
        periodEnd: PERIOD_END,
        endsAt: null,
        card: { brand: "visa", last4: "4242", expMonth: 4, expYear: 2030 },
        invoices: [{ id: "in_1", number: "INV-0001", created: 1790000000, total: 9900, currency: "cad", status: "paid", hostedUrl: "https://invoice.stripe.com/i/x" }],
      },
    });
  });

  test("C3106: the end date is cancel_at when set", async () => {
    handler = stripe({ sub: () => reply(200, subscription({ cancel_at: 1800000000, cancel_at_period_end: false })) });
    const result = await gateway().overview(IDS);
    expect(result.ok && result.overview.endsAt).toBe(1800000000);
  });

  test("C3106: the end date is the period end when only cancel_at_period_end is true", async () => {
    handler = stripe({ sub: () => reply(200, subscription({ cancel_at: null, cancel_at_period_end: true })) });
    const result = await gateway().overview(IDS);
    expect(result.ok && result.overview.endsAt).toBe(PERIOD_END);
  });

  test("C3106: the card is the customer's default when the subscription has none", async () => {
    handler = stripe({
      sub: () => reply(200, subscription({ default_payment_method: null })),
      cust: () => reply(200, customer({ invoice_settings: { default_payment_method: mastercard } })),
    });
    const result = await gateway().overview(IDS);
    expect(result.ok && result.overview.card).toEqual({ brand: "mastercard", last4: "0005", expMonth: 12, expYear: 2031 });
  });

  test("C3106: the subscription's card wins over the customer's", async () => {
    handler = stripe({ cust: () => reply(200, customer({ invoice_settings: { default_payment_method: mastercard } })) });
    const result = await gateway().overview(IDS);
    expect(result.ok && result.overview.card?.last4).toBe("4242");
  });

  test("C3106: no card anywhere is null", async () => {
    handler = stripe({ sub: () => reply(200, subscription({ default_payment_method: null })) });
    const result = await gateway().overview(IDS);
    expect(result.ok && result.overview.card).toBeNull();
  });

  test("C3142: a failed customer read is unavailable when the subscription has no card of its own, and tolerated when it has one", async () => {
    handler = stripe({ cust: () => reply(500, { error: { code: "api_error" } }), sub: () => reply(200, subscription({ default_payment_method: null })) });
    expect(await gateway().overview(IDS)).toEqual({ ok: false, code: "unavailable" });
    handler = stripe({ cust: () => reply(500, { error: { code: "api_error" } }) });
    const result = await gateway().overview(IDS);
    expect(result.ok && result.overview.card?.last4).toBe("4242");
  });

  test("C3108: an invoice read that fails leaves the rest of the overview and marks the invoices unavailable", async () => {
    handler = stripe({ inv: () => reply(500, { error: { code: "api_error" } }) });
    const result = await gateway().overview(IDS);
    expect(result.ok).toBe(true);
    expect(result.ok && result.overview.invoices).toBe("unavailable");
    expect(result.ok && result.overview.status).toBe("trialing");
  });
});

describe("a failing subscription read", () => {
  const secrets = [IDS.customerId, IDS.subscriptionId, KEY, "leaky body text"];

  test.each([
    ["no status", () => reply(200, { id: IDS.subscriptionId })],
    ["a body that is not JSON", () => new Response("<html>", { status: 200 })],
    ["a 400", () => reply(400, { error: { code: "invalid_request_error", message: "leaky body text" } })],
    ["a 401", () => reply(401, { error: { code: "api_key_expired", message: "leaky body text" } })],
    ["a 429", () => reply(429, { error: { code: "rate_limit", message: "leaky body text" } })],
    ["a 500", () => reply(500, { error: { code: "api_error", message: "leaky body text" } })],
  ])("C3109: %s is unavailable, logged once, with no id, key or body text", async (_name, make) => {
    handler = stripe({ sub: make });
    const result = await gateway().overview(IDS);
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    for (const secret of secrets) {
      expect(logged()).not.toContain(secret);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  test("C3109: the log line holds the status and Stripe's error code", async () => {
    handler = stripe({ sub: () => reply(500, { error: { code: "api_error" } }) });
    await gateway().overview(IDS);
    expect(logged()).toContain("500");
    expect(logged()).toContain("api_error");
  });

  test("C3109: a refused connection is unavailable and logged once without ids or key", async () => {
    handler = (call) => {
      if (call.url.pathname.includes("/subscriptions/")) throw new TypeError(`fetch failed for ${IDS.customerId} ${KEY}`);
      return stripe()(call);
    };
    expect(await gateway().overview(IDS)).toEqual({ ok: false, code: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    for (const secret of secrets) expect(logged()).not.toContain(secret);
  });

  test("C3109: a subscription request still open after 10 s is aborted, unavailable, logged once", async () => {
    vi.useFakeTimers();
    handler = (call) => {
      if (!call.url.pathname.includes("/subscriptions/")) return stripe()(call);
      return new Promise<Response>(() => {}) as unknown as Response;
    };
    fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
      const call: Call = { url: new URL(url), method: init.method ?? "GET", headers: (init.headers ?? {}) as Record<string, string>, body: null };
      calls.push(call);
      if (!call.url.pathname.includes("/subscriptions/")) return stripe()(call);
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const pending = gateway().overview(IDS);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(errorLog).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: false, code: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    for (const secret of secrets) expect(logged()).not.toContain(secret);
  });
});

describe("starting a card update", () => {
  test("C3113: one POST to setup_intents with exactly customer and off_session, answering the client secret", async () => {
    expect(await gateway().startCardUpdate(IDS)).toEqual({ ok: true, clientSecret: "seti_1_secret_abc" });
    expect(posts()).toHaveLength(1);
    expect(posts()[0].url.pathname).toBe("/v1/setup_intents");
    expect(posts()[0].headers.Authorization).toBe(`Bearer ${KEY}`);
    const body = form(posts()[0]);
    expect([...body.keys()].sort()).toEqual(["customer", "usage"]);
    expect(body.get("customer")).toBe(IDS.customerId);
    expect(body.get("usage")).toBe("off_session");
  });

  test.each([
    ["a 400", () => reply(400, { error: { code: "invalid_request_error" } })],
    ["a missing secret", () => reply(200, { id: "seti_1" })],
    ["an empty secret", () => reply(200, { client_secret: "" })],
    ["a non-string secret", () => reply(200, { client_secret: 4 })],
  ])("C3113: %s is unavailable", async (_name, make) => {
    handler = stripe({ write: make });
    expect(await gateway().startCardUpdate(IDS)).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("finishing a card update", () => {
  test("C3114: reads the SetupIntent itself, then makes its card the default on the customer and the subscription, two writes", async () => {
    expect(await gateway().finishCardUpdate(IDS, "seti_1")).toEqual({ ok: true });
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url.pathname).toBe("/v1/setup_intents/seti_1");
    expect(posts()).toHaveLength(2);
    const customerWrite = posts().find((call) => call.url.pathname === `/v1/customers/${IDS.customerId}`)!;
    expect([...form(customerWrite).keys()]).toEqual(["invoice_settings[default_payment_method]"]);
    expect(form(customerWrite).get("invoice_settings[default_payment_method]")).toBe("pm_new");
    const subWrite = posts().find((call) => call.url.pathname === `/v1/subscriptions/${IDS.subscriptionId}`)!;
    expect([...form(subWrite).keys()]).toEqual(["default_payment_method"]);
    expect(form(subWrite).get("default_payment_method")).toBe("pm_new");
  });

  test.each([
    ["requires_payment_method", { status: "requires_payment_method", customer: IDS.customerId, payment_method: "pm_new" }],
    ["requires_action", { status: "requires_action", customer: IDS.customerId, payment_method: "pm_new" }],
    ["processing", { status: "processing", customer: IDS.customerId, payment_method: "pm_new" }],
    ["canceled", { status: "canceled", customer: IDS.customerId, payment_method: "pm_new" }],
    ["another customer", { status: "succeeded", customer: "cus_SomeoneElse", payment_method: "pm_new" }],
    ["no payment method", { status: "succeeded", customer: IDS.customerId, payment_method: null }],
  ])("C3115: a SetupIntent with %s is a mismatch and no write is made", async (_name, setupIntent) => {
    handler = stripe({ seti: () => reply(200, { id: "seti_1", ...setupIntent }) });
    expect(await gateway().finishCardUpdate(IDS, "seti_1")).toEqual({ ok: false, code: "mismatch" });
    expect(posts()).toEqual([]);
  });

  test("C3115: a SetupIntent that cannot be read is unavailable and no write is made", async () => {
    handler = stripe({ seti: () => reply(404, { error: { code: "resource_missing" } }) });
    expect(await gateway().finishCardUpdate(IDS, "seti_1")).toEqual({ ok: false, code: "unavailable" });
    expect(posts()).toEqual([]);
  });

  test("C3116: finishing the same SetupIntent twice issues the same writes and answers ok both times", async () => {
    const first = await gateway().finishCardUpdate(IDS, "seti_1");
    const firstWrites = posts().map((call) => `${call.url.pathname} ${call.body}`).sort();
    calls.length = 0;
    const second = await gateway().finishCardUpdate(IDS, "seti_1");
    const secondWrites = posts().map((call) => `${call.url.pathname} ${call.body}`).sort();
    expect([first, second]).toEqual([{ ok: true }, { ok: true }]);
    expect(secondWrites).toEqual(firstWrites);
    expect(firstWrites).toHaveLength(2);
  });

  test("C3114: the customer write succeeding and the subscription write failing is unavailable, never saved", async () => {
    handler = stripe({
      write: () => reply(200, { id: "obj_1" }),
    });
    const inner = handler;
    handler = (call) => (call.method === "POST" && call.url.pathname.startsWith("/v1/subscriptions/") ? reply(500, { error: { code: "api_error" } }) : inner(call));
    expect(await gateway().finishCardUpdate(IDS, "seti_1")).toEqual({ ok: false, code: "unavailable" });
    expect(posts().map((call) => call.url.pathname)).toEqual([`/v1/customers/${IDS.customerId}`, `/v1/subscriptions/${IDS.subscriptionId}`]);
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  test("C3114: a failing write is unavailable and logged once without ids, key or body", async () => {
    handler = stripe({ write: () => reply(500, { error: { code: "api_error", message: "leaky body text" } }) });
    expect(await gateway().finishCardUpdate(IDS, "seti_1")).toEqual({ ok: false, code: "unavailable" });
    for (const secret of [IDS.customerId, IDS.subscriptionId, KEY, "leaky body text", "pm_new"]) expect(logged()).not.toContain(secret);
  });
});

describe("cancelling and resuming", () => {
  test("C3120: cancel is one POST to the subscription that ends it at the period end, never a DELETE", async () => {
    expect(await gateway().cancel(IDS)).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url.pathname).toBe(`/v1/subscriptions/${IDS.subscriptionId}`);
    expect([...form(calls[0]).entries()]).toEqual([["cancel_at_period_end", "true"]]);
  });

  test("C3120: resume is one POST that clears the end", async () => {
    expect(await gateway().resume(IDS)).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe(`/v1/subscriptions/${IDS.subscriptionId}`);
    expect([...form(calls[0]).entries()]).toEqual([["cancel_at_period_end", "false"]]);
  });

  test.each(["cancel", "resume"] as const)("C3120: a failing %s is unavailable, logged once, without ids, key or body", async (action) => {
    handler = stripe({ write: () => reply(500, { error: { code: "api_error", message: "leaky body text" } }) });
    expect(await gateway()[action](IDS)).toEqual({ ok: false, code: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    for (const secret of [IDS.customerId, IDS.subscriptionId, KEY, "leaky body text"]) expect(logged()).not.toContain(secret);
  });

  test("C3121: cancelling twice and resuming twice send the same write and answer ok each time", async () => {
    const out = [await gateway().cancel(IDS), await gateway().cancel(IDS), await gateway().resume(IDS), await gateway().resume(IDS)];
    expect(out).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
    expect(calls.map((call) => call.body)).toEqual(["cancel_at_period_end=true", "cancel_at_period_end=true", "cancel_at_period_end=false", "cancel_at_period_end=false"]);
  });
});
