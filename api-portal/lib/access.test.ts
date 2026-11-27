import { beforeEach, describe, expect, test, vi } from "vitest";

type Fake = {
  claims: { sub: string; email?: string } | null;
  membership: { role: string; orgs: { name: string } } | null;
  plan: unknown;
  calls: { tool: string; source: string; ok: boolean; called_at: string; user_id: string }[] | null;
  members: { user_id: string; email: string }[];
};
let fake: Fake;

const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "portal.test", "x-forwarded-proto": "https" }) }));
vi.mock("./supabase", () => ({
  createSupabase: async () => ({
    auth: { getClaims: async () => ({ data: fake.claims ? { claims: fake.claims } : null }) },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: async () => (table === "memberships" ? { data: fake.membership ? [fake.membership] : [], error: null } : fake.calls ? { data: fake.calls, error: null } : { data: null, error: { code: "x" } }),
      };
      return chain;
    },
    rpc: (name: string) => (name === "org_plan" ? Promise.resolve({ data: fake.plan, error: null }) : { limit: async () => ({ data: fake.members, error: null }) }),
  }),
}));

const { requirePortalMember, portalOrigin } = await import("./access");
const { loadLogs } = await import("./logs");

const NOW = new Date("2026-11-27T20:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
  fake = {
    claims: { sub: "u1", email: "owner@acme.ca" },
    membership: { role: "owner", orgs: { name: "Acme" } },
    plan: "team",
    calls: [],
    members: [{ user_id: "u1", email: "owner@acme.ca" }],
  };
});

describe("who may use the portal", () => {
  test("an owner or admin on Team or Business may", async () => {
    expect(await requirePortalMember()).toMatchObject({ userId: "u1", email: "owner@acme.ca", orgName: "Acme", role: "owner", plan: "team", appUrl: "https://app.test" });
    fake.membership = { role: "admin", orgs: { name: "Acme" } };
    fake.plan = "business";
    expect(await requirePortalMember()).toMatchObject({ role: "admin", plan: "business" });
  });

  test("signed out goes to the app's sign-in", async () => {
    fake.claims = null;
    await expect(requirePortalMember()).rejects.toThrow("redirect:https://app.test/login");
  });

  test.each(["estimator", "viewer"])("a %s goes back to the app's Pipeline", async (role) => {
    fake.membership = { role, orgs: { name: "Acme" } };
    await expect(requirePortalMember()).rejects.toThrow("redirect:https://app.test/pipeline");
  });

  test("a Starter company, no plan, or a signed-in person with no company goes back to the Pipeline", async () => {
    for (const plan of ["starter", null, 42]) {
      fake.plan = plan;
      await expect(requirePortalMember()).rejects.toThrow("redirect:https://app.test/pipeline");
    }
    fake.plan = "team";
    fake.membership = null;
    await expect(requirePortalMember()).rejects.toThrow("redirect:https://app.test/pipeline");
  });

  test("the portal's own address comes from the request", async () => {
    expect(await portalOrigin()).toBe("https://portal.test");
  });
});

describe("the activity log", () => {
  const call = (over: Partial<Fake["calls"] extends infer T ? (T extends (infer U)[] ? U : never) : never> = {}) => ({ tool: "search_customers", source: "api", ok: true, called_at: "2026-11-27T19:00:00Z", user_id: "u1", ...over });

  test("names the member by email and a former member plainly", async () => {
    fake.calls = [call(), call({ user_id: "gone" })];
    const { lines } = await loadLogs((await (await import("./supabase")).createSupabase()) as never, {}, NOW);
    expect(lines?.map((line) => line.who)).toEqual(["owner@acme.ca", "A former member"]);
  });

  test("leaves in-app calls out, and filters by door and by failures", async () => {
    fake.calls = [call(), call({ source: "mcp" }), call({ source: "mcp", ok: false }), call({ source: "app" })];
    const supabase = (await (await import("./supabase")).createSupabase()) as never;
    expect((await loadLogs(supabase, {}, NOW)).lines).toHaveLength(3);
    expect((await loadLogs(supabase, { door: "mcp" }, NOW)).lines).toHaveLength(2);
    expect((await loadLogs(supabase, { result: "failed" }, NOW)).lines).toHaveLength(1);
    expect((await loadLogs(supabase, { door: "nope", result: "x" }, NOW)).lines).toHaveLength(3);
  });

  test("a log that cannot be read is null, and a row carries only tool, door, result, member and time", async () => {
    const supabase = (await (await import("./supabase")).createSupabase()) as never;
    fake.calls = [call()];
    expect(Object.keys((await loadLogs(supabase, {}, NOW)).lines?.[0] ?? {}).sort()).toEqual(["at", "door", "ok", "tool", "userId", "who"]);
    fake.calls = null;
    expect((await loadLogs(supabase, {}, NOW)).lines).toBeNull();
  });
});
