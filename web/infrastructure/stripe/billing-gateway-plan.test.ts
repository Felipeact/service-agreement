import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STRIPE_VERSION } from "./http";
import { stripeBillingGateway } from "./billing-gateway";

const KEY = "sk_test_unit_key_0000";
const IDS = { customerId: "cus_TestCustomer1", subscriptionId: "sub_TestSub1" };
const PERIOD_END = 1795547955;

type Call = { url: URL; method: string; headers: Record<string, string>; body: string | null };
type Handler = (call: Call) => Response | Promise<Response>;
let calls: Call[];
let fetchMock: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;
let handler: Handler;

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const planItem = (plan: string) => ({
  id: "si_plan",
  quantity: 1,
  current_period_end: PERIOD_END,
  price: { product: { id: "prod_old", metadata: { sa_kind: "plan", sa_plan: plan } } },
});
const seatItem = (quantity: number) => ({ id: "si_seat", quantity, current_period_end: PERIOD_END, price: { product: { id: "prod_seat", metadata: { sa_kind: "seat" } } } });
const untagged = { id: "si_x", quantity: 1, current_period_end: PERIOD_END, price: { product: { id: "prod_x", metadata: {} } } };

const subscription = (items: unknown[]) => ({
  id: IDS.subscriptionId,
  status: "active",
  trial_end: null,
  cancel_at_period_end: false,
  cancel_at: null,
  items: { data: items },
  default_payment_method: null,
});
const subWith = (items: unknown[]) => () => reply(200, subscription(items));

type Route = { sub?: () => Response; productRead?: (id: string) => Response; productCreate?: () => Response; update?: () => Response };

/** Routes for the plan change: the subscription read, `GET /v1/products/{id}`, `POST /v1/products` and `POST /v1/subscriptions/{id}`. */
function routes(route: Route): Handler {
  return (call) => {
    const path = call.url.pathname;
    const last = path.split("/").pop() ?? "";
    if (call.method === "GET" && path === `/v1/subscriptions/${IDS.subscriptionId}`) return (route.sub ?? subWith([planItem("starter")]))();
    if (call.method === "GET" && path === `/v1/customers/${IDS.customerId}`) return reply(200, { id: IDS.customerId, invoice_settings: { default_payment_method: null } });
    if (call.method === "GET" && path === "/v1/invoices") return reply(200, { data: [] });
    if (call.method === "GET" && path.startsWith("/v1/products/")) return (route.productRead ?? (() => reply(200, { id: last })))(last);
    if (call.method === "POST" && path === "/v1/products") return (route.productCreate ?? (() => reply(200, { id: "created" })))();
    if (call.method === "POST" && path === `/v1/subscriptions/${IDS.subscriptionId}`) return (route.update ?? (() => reply(200, { id: IDS.subscriptionId })))();
    return reply(404, { error: { code: "resource_missing" } });
  };
}

beforeEach(() => {
  calls = [];
  handler = routes({});
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
const keys = (call: Call) => [...form(call).keys()].sort();
const logged = () => errorLog.mock.calls.map((args: unknown[]) => args.join(" ")).join("\n");
const productPosts = () => posts().filter((call) => call.url.pathname === "/v1/products");
const updates = () => posts().filter((call) => call.url.pathname === `/v1/subscriptions/${IDS.subscriptionId}`);

describe("the plan and seats read from the subscription items", () => {
  test.each([
    ["a starter plan item and no seat item", [planItem("starter")], "starter", 0],
    ["a team plan item and a seat item of 3", [planItem("team"), seatItem(3)], "team", 3],
    ["a business plan item listed after the seat item", [seatItem(2), planItem("business")], "business", 2],
  ])("C3201: %s", async (_name, items, plan, extra) => {
    handler = routes({ sub: subWith(items) });
    const result = await gateway().overview(IDS);
    expect(result.ok && result.overview.plan).toBe(plan);
    expect(result.ok && result.overview.extraSeats).toBe(extra);
  });

  test.each([
    ["no item tagged as a plan", [untagged]],
    ["a plan item whose sa_plan is not one of the three", [planItem("platinum")]],
    ["items that carry no expanded product", [{ id: "si_x", quantity: 1, current_period_end: PERIOD_END, price: { product: "prod_x" } }]],
  ])("C3201: %s leaves the plan unknown and does not guess an item", async (_name, items) => {
    handler = routes({ sub: subWith(items) });
    const result = await gateway().overview(IDS);
    expect(result.ok && result.overview.plan).toBeNull();
  });
});

describe("changing the plan", () => {
  test("C3206: reads the subscription with its items expanded, checks the product, then one update with the plan item, its price and proration", async () => {
    expect(await gateway().changePlan(IDS, { plan: "team", extraSeats: 0 })).toEqual({ ok: true, changed: true });
    expect(calls.map((call) => `${call.method} ${call.url.pathname}`)).toEqual([
      `GET /v1/subscriptions/${IDS.subscriptionId}`,
      "GET /v1/products/sa_plan_team",
      `POST /v1/subscriptions/${IDS.subscriptionId}`,
    ]);
    expect(calls[0].url.searchParams.getAll("expand[]")).toEqual(["items.data.price.product"]);
    expect(productPosts()).toEqual([]);
    expect(keys(updates()[0])).toEqual([
      "items[0][id]",
      "items[0][price_data][currency]",
      "items[0][price_data][product]",
      "items[0][price_data][recurring][interval]",
      "items[0][price_data][unit_amount]",
      "proration_behavior",
    ]);
    const body = form(updates()[0]);
    expect(body.get("items[0][id]")).toBe("si_plan");
    expect(body.get("items[0][price_data][currency]")).toBe("cad");
    expect(body.get("items[0][price_data][unit_amount]")).toBe("9900");
    expect(body.get("items[0][price_data][recurring][interval]")).toBe("month");
    expect(body.get("items[0][price_data][product]")).toBe("sa_plan_team");
    expect(body.get("proration_behavior")).toBe("create_prorations");
    for (const call of calls) {
      expect(call.headers.Authorization).toBe(`Bearer ${KEY}`);
      expect(call.headers["Stripe-Version"]).toBe(STRIPE_VERSION);
    }
  });

  test.each([
    ["starter", "team", "Starter plan", "4900"],
    ["team", "starter", "Team plan", "9900"],
    ["business", "starter", "Business plan", "19900"],
  ] as const)("C3206: a 404 on the product read creates %s once with its id, name and tags, then updates the price", async (plan, from, name, unit) => {
    handler = routes({ productRead: () => reply(404, { error: { code: "resource_missing" } }), sub: subWith([planItem(from)]) });
    expect(await gateway().changePlan(IDS, { plan, extraSeats: 0 })).toEqual({ ok: true, changed: true });
    expect(productPosts()).toHaveLength(1);
    expect(keys(productPosts()[0])).toEqual(["id", "metadata[sa_kind]", "metadata[sa_plan]", "name"]);
    const created = form(productPosts()[0]);
    expect(created.get("id")).toBe(`sa_plan_${plan}`);
    expect(created.get("name")).toBe(name);
    expect(created.get("metadata[sa_kind]")).toBe("plan");
    expect(created.get("metadata[sa_plan]")).toBe(plan);
    expect(form(updates()[0]).get("items[0][price_data][unit_amount]")).toBe(unit);
  });

  test("C3206: an existing seat item is set to the new quantity", async () => {
    handler = routes({ sub: subWith([planItem("starter"), seatItem(2)]) });
    expect(await gateway().changePlan(IDS, { plan: "team", extraSeats: 3 })).toEqual({ ok: true, changed: true });
    const body = form(updates()[0]);
    expect(body.get("items[1][id]")).toBe("si_seat");
    expect(body.get("items[1][quantity]")).toBe("3");
    expect(keys(updates()[0]).filter((key) => key.startsWith("items[1]"))).toEqual(["items[1][id]", "items[1][quantity]"]);
  });

  test("C3206: a seat item no longer needed is deleted", async () => {
    handler = routes({ sub: subWith([planItem("starter"), seatItem(2)]) });
    expect(await gateway().changePlan(IDS, { plan: "business", extraSeats: 0 })).toEqual({ ok: true, changed: true });
    const body = form(updates()[0]);
    expect(body.get("items[1][id]")).toBe("si_seat");
    expect(body.get("items[1][deleted]")).toBe("true");
    expect(body.get("items[1][quantity]")).toBeNull();
  });

  test("C3206: with no seat item and extra seats needed, one is added on the extra-seat product at 15 dollars", async () => {
    handler = routes({ sub: subWith([planItem("business")]) });
    expect(await gateway().changePlan(IDS, { plan: "starter", extraSeats: 2 })).toEqual({ ok: true, changed: true });
    expect(calls.map((call) => `${call.method} ${call.url.pathname}`)).toContain("GET /v1/products/sa_extra_seat");
    const body = form(updates()[0]);
    expect(body.get("items[1][price_data][product]")).toBe("sa_extra_seat");
    expect(body.get("items[1][price_data][currency]")).toBe("cad");
    expect(body.get("items[1][price_data][unit_amount]")).toBe("1500");
    expect(body.get("items[1][price_data][recurring][interval]")).toBe("month");
    expect(body.get("items[1][quantity]")).toBe("2");
    expect(body.get("items[1][id]")).toBeNull();
  });

  test("C3206: a missing extra-seat product is created with the seat tag only", async () => {
    handler = routes({
      sub: subWith([planItem("business")]),
      productRead: (id) => (id === "sa_extra_seat" ? reply(404, { error: { code: "resource_missing" } }) : reply(200, { id })),
    });
    await gateway().changePlan(IDS, { plan: "starter", extraSeats: 1 });
    expect(productPosts()).toHaveLength(1);
    expect(keys(productPosts()[0])).toEqual(["id", "metadata[sa_kind]", "name"]);
    expect(form(productPosts()[0]).get("id")).toBe("sa_extra_seat");
    expect(form(productPosts()[0]).get("name")).toBe("Extra seat");
    expect(form(productPosts()[0]).get("metadata[sa_kind]")).toBe("seat");
  });

  test("C3206: when only the seats change the plan item is left out of the update", async () => {
    handler = routes({ sub: subWith([planItem("team"), seatItem(1)]) });
    expect(await gateway().changePlan(IDS, { plan: "team", extraSeats: 4 })).toEqual({ ok: true, changed: true });
    expect(keys(updates()[0]).filter((key) => key.includes("price_data"))).toEqual([]);
    expect(form(updates()[0]).get("items[0][id]")).toBe("si_seat");
    expect(productPosts()).toEqual([]);
  });

  test.each([
    ["team with no seat item and none wanted", [planItem("team")], 0],
    ["team with a seat item of 2 and 2 wanted", [planItem("team"), seatItem(2)], 2],
  ])("C3207: %s makes only the subscription read and no write", async (_name, items, extra) => {
    handler = routes({ sub: subWith(items) });
    expect(await gateway().changePlan(IDS, { plan: "team", extraSeats: extra })).toEqual({ ok: true, changed: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
    expect(posts()).toEqual([]);
  });
});

describe("a plan change that cannot proceed", () => {
  const secrets = [IDS.customerId, IDS.subscriptionId, KEY, "leaky body text"];
  const leaky = (status: number) => () => reply(status, { error: { code: "api_error", message: "leaky body text" } });

  test.each([
    ["the subscription read failing", { sub: leaky(500) }, 0, 0],
    ["the product read answering 500", { productRead: leaky(500) }, 0, 0],
    ["the product read answering 403", { productRead: leaky(403) }, 0, 0],
    ["the product create failing", { productRead: () => reply(404, { error: { code: "resource_missing" } }), productCreate: leaky(500) }, 1, 0],
    ["the subscription update failing", { update: leaky(500) }, 0, 1],
  ] as const)("C3208: %s is unavailable, logged once with no id, key or body text, and writes nothing more", async (_name, route, productWrites, updateWrites) => {
    handler = routes(route as Route);
    const result = await gateway().changePlan(IDS, { plan: "team", extraSeats: 0 });
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(productPosts()).toHaveLength(productWrites);
    expect(updates()).toHaveLength(updateWrites);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(logged()).toMatch(/HTTP \d{3}/);
    for (const secret of secrets) {
      expect(logged()).not.toContain(secret);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  test("C3208: a subscription with no tagged plan item is unsupported, logged once, and nothing is written", async () => {
    handler = routes({ sub: subWith([untagged]) });
    expect(await gateway().changePlan(IDS, { plan: "team", extraSeats: 0 })).toEqual({ ok: false, code: "unsupported" });
    expect(posts()).toEqual([]);
    expect(errorLog).toHaveBeenCalledTimes(1);
    for (const secret of secrets) expect(logged()).not.toContain(secret);
  });

  test("C3208: a refused connection on the product read is unavailable, logged once without ids or key", async () => {
    const inner = routes({});
    handler = (call) => {
      if (call.url.pathname.startsWith("/v1/products/")) throw new TypeError(`fetch failed for ${IDS.customerId} ${KEY}`);
      return inner(call);
    };
    expect(await gateway().changePlan(IDS, { plan: "team", extraSeats: 0 })).toEqual({ ok: false, code: "unavailable" });
    expect(updates()).toEqual([]);
    expect(errorLog).toHaveBeenCalledTimes(1);
    for (const secret of secrets) expect(logged()).not.toContain(secret);
  });

  test("C3208: an update still open after 10 s is aborted, unavailable and logged once", async () => {
    vi.useFakeTimers();
    const inner = routes({});
    fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
      const call: Call = { url: new URL(url), method: init.method ?? "GET", headers: (init.headers ?? {}) as Record<string, string>, body: typeof init.body === "string" ? init.body : null };
      calls.push(call);
      if (call.method === "POST" && call.url.pathname.startsWith("/v1/subscriptions/")) {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      return inner(call);
    });
    const pending = gateway().changePlan(IDS, { plan: "team", extraSeats: 0 });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(errorLog).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: false, code: "unavailable" });
    expect(errorLog).toHaveBeenCalledTimes(1);
    for (const secret of secrets) expect(logged()).not.toContain(secret);
  });
});
