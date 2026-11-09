import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

// Only the Supabase client is replaced, so its options and its calls can be read. The use case and both adapters are the real ones.
const rpc = vi.fn();
const signInWithOtp = vi.fn();
const createClient = vi.fn<(url: string, key: string, options: unknown) => unknown>(() => ({ rpc, auth: { signInWithOtp } }));
vi.mock("@supabase/supabase-js", async (importOriginal) => ({ ...(await importOriginal<typeof import("@supabase/supabase-js")>()), createClient }));

const { getWebhookContainer } = await import("./index");

const DELIVERY = { body: '{"id":"evt_1","type":"checkout.session.completed"}', signature: `t=1790000000,v1=${"a".repeat(64)}` };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_service_must_not_be_used");
  signInWithOtp.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the Stripe webhook container sends the owner's link", () => {
  test("C2719: a provisioned delivery reaches signInWithOtp with shouldCreateUser, from the one session-less publishable-key client", async () => {
    rpc.mockResolvedValue({ data: { outcome: "recorded", provisioned: { email: "owner.one@shop.test" } }, error: null });
    const { receiveStripe } = await getWebhookContainer();
    expect(await receiveStripe(DELIVERY)).toEqual({ ok: true, outcome: "recorded" });
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "owner.one@shop.test", options: { shouldCreateUser: true } });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0].slice(0, 2)).toEqual(["https://example.supabase.co", "sb_publishable_test"]);
    expect(createClient.mock.calls[0][2]).toEqual({ auth: { persistSession: false, autoRefreshToken: false } });
    expect(JSON.stringify(createClient.mock.calls)).not.toContain("sb_service_must_not_be_used");
  });

  test("C2719: a delivery that created nothing sends nothing", async () => {
    rpc.mockResolvedValue({ data: { outcome: "duplicate" }, error: null });
    const { receiveStripe } = await getWebhookContainer();
    await receiveStripe(DELIVERY);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});

describe("one sender", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (name === "node_modules" || name === ".next") return [];
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  const source = (path: string) => /\.tsx?$/.test(path) && !/\.test\./.test(path);

  test("C2729: signInWithOtp is called only in the two adapters that existed before this feature, and nowhere in application or app", () => {
    const root = join(__dirname, "..");
    const callers = walk(join(root, "infrastructure"))
      .filter(source)
      .filter((path) => readFileSync(path, "utf8").includes("signInWithOtp"))
      .map((path) => path.slice(root.length + 1).replaceAll("\\", "/"))
      .sort();
    expect(callers).toEqual(["infrastructure/supabase/auth.ts", "infrastructure/supabase/members.ts"]);
    const outside = [...walk(join(root, "application")), ...walk(join(root, "app"))].filter(source).filter((path) => readFileSync(path, "utf8").includes("signInWithOtp"));
    expect(outside).toEqual([]);
  });
});
