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

const NAMES = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY"] as const;
const saved: Partial<Record<(typeof NAMES)[number], string | undefined>> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of NAMES) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

const SELECTIONS = (["starter", "team", "business"] as const).flatMap((plan) => [
  { plan, trades: ["hvac"] },
  { plan, trades: ["hvac", "plumbing", "electrical", "other"] },
]);

describe("the billing container", () => {
  test.each(SELECTIONS)("C2422: with no environment at all, $plan with $trades.length trade(s) answers not_configured and touches no cookie, connection or Supabase client", async ({ plan, trades }) => {
    const { startTrial } = await getBillingContainer();

    expect(await startTrial({ plan, trades })).toEqual({ status: "not_configured" });
    expect(cookies).not.toHaveBeenCalled();
    expect(connection).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
