import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const TOKEN = "a".repeat(40);
const SITE = "3f2b8a52-6c1e-4d52-9a1c-0b7d6e4f1a10";

const runTool = vi.fn();
let plan: string | null = "business";
let allowed = true;

vi.mock("@/composition", async () => {
  const real = await import("@/domain/billing/plan-access");
  const api = await import("@/domain/public-api");
  return {
    accessOf: real.accessOf,
    planAllows: real.planAllows,
    planAccessMessage: real.planAccessMessage,
    resolveRoute: api.resolveRoute,
    statusForFailure: api.statusForFailure,
    checkApiRate: () => (allowed ? { allowed: true } : { allowed: false, retryAfterSeconds: 7 }),
    getApiContainer: async (token: string) => (token === TOKEN ? { caller: { userId: "u1", email: "a@b.ca", orgName: "Acme", role: "owner", canWrite: true, plan }, runTool } : null),
  };
});

const { GET, POST, OPTIONS } = await import("./route");

const call = (method: "GET" | "POST", path: string, init: { token?: string | null; body?: string } = {}) => {
  const request = new NextRequest(`https://app.test/api/v1/${path}`, {
    method,
    headers: init.token === null ? {} : { authorization: `Bearer ${init.token ?? TOKEN}` },
    body: init.body,
  });
  const handler = method === "GET" ? GET : POST;
  return handler(request, { params: Promise.resolve({ path: path.split("?")[0].split("/") }) } as never);
};

beforeEach(() => {
  runTool.mockReset();
  plan = "business";
  allowed = true;
});

describe("/api/v1", () => {
  test("no token is 401 with a pointer to the metadata", async () => {
    const res = await call("GET", "me", { token: null });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource/api/v1");
  });

  test("a token Supabase does not know is 401", async () => {
    expect((await call("GET", "me", { token: "b".repeat(40) })).status).toBe(401);
  });

  test("a read runs the mapped tool and wraps the answer in data", async () => {
    runTool.mockResolvedValue({ ok: true, data: { count: 0, customers: [] } });
    const res = await call("GET", "customers?query=acme&limit=3");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { count: 0, customers: [] } });
    expect(runTool).toHaveBeenCalledWith("search_customers", { query: "acme", limit: 3 }, expect.objectContaining({ userId: "u1" }));
  });

  test("a create answers 201", async () => {
    runTool.mockResolvedValue({ ok: true, data: { agreementId: "ag-1" } });
    const res = await call("POST", "agreements", { body: JSON.stringify({ site_id: SITE }) });
    expect(res.status).toBe(201);
    expect(runTool).toHaveBeenCalledWith("create_agreement_draft", { site_id: SITE }, expect.anything());
  });

  test("Starter is refused with 403 and the tool never runs", async () => {
    plan = "starter";
    const res = await call("GET", "customers");
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toContain("Team plan and above");
    expect(runTool).not.toHaveBeenCalled();
  });

  test("Team can read but not write", async () => {
    plan = "team";
    runTool.mockResolvedValue({ ok: true, data: {} });
    expect((await call("GET", "me")).status).toBe(200);
    expect((await call("POST", "agreements", { body: JSON.stringify({ site_id: SITE }) })).status).toBe(403);
  });

  test("a tool failure maps to its status", async () => {
    runTool.mockResolvedValue({ ok: false, error: "No agreement with that id." });
    expect((await call("GET", `agreements/${SITE}`)).status).toBe(404);
  });

  test("an unknown path is 404, a wrong method 405, bad JSON 400", async () => {
    expect((await call("GET", "nope")).status).toBe(404);
    expect((await call("POST", "customers", { body: "{}" })).status).toBe(405);
    expect((await call("POST", "agreements", { body: "{not json" })).status).toBe(400);
  });

  test("over the rate is 429 with Retry-After", async () => {
    allowed = false;
    const res = await call("GET", "me");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
  });
});

describe("/api/v1 and the API portal", () => {
  test("a call from the portal origin gets CORS headers, another origin does not", async () => {
    runTool.mockResolvedValue({ ok: true, data: {} });
    const from = (origin: string) => GET(new NextRequest("https://app.test/api/v1/me", { headers: { authorization: `Bearer ${TOKEN}`, origin } }), { params: Promise.resolve({ path: ["me"] }) } as never);
    expect((await from("http://localhost:3001")).headers.get("access-control-allow-origin")).toBe("http://localhost:3001");
    expect((await from("https://evil.example")).headers.get("access-control-allow-origin")).toBeNull();
  });

  test("the preflight answers 204 with the headers only for the portal", () => {
    const preflight = (origin: string) => OPTIONS(new NextRequest("https://app.test/api/v1/me", { method: "OPTIONS", headers: { origin } }));
    const ok = preflight("http://localhost:3001");
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(preflight("https://evil.example").headers.get("access-control-allow-origin")).toBeNull();
  });
});
