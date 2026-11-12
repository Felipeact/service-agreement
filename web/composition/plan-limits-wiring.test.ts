import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const BYTES = new Uint8Array([1, 2, 3]);
const extract = vi.fn(async () => ({ ok: true as const, rows: [] }));
const check = vi.fn(async () => ({ ok: true as const, allowed: false as const, plan: "starter", limit: 10, used: 10, resetsOn: "2026-12-01" }));
const read = vi.fn(async () => ({ plan: "starter", liveAgreements: { used: 7, limit: 15 }, aiImports: { used: 3, limit: 10 }, resetsOn: "2026-12-01" }));

vi.mock("@/infrastructure/supabase/imports", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/imports")>()),
  supabaseImportJobStore: () => ({
    sourceOf: async () => ({ ok: true, status: "parsed", contentType: "text/csv", progress: null, result: null, bytes: BYTES }),
    recordExtraction: vi.fn(),
  }),
}));
vi.mock("@/infrastructure/import-parsers", () => ({
  importParser: { parse: async () => ({ ok: true, parsed: { format: "table", text: "t", tables: [{ source: "Units", header: ["Unit"], rows: [{ ref: "Units!2", cells: ["U1"] }] }] } }) },
}));
vi.mock("@/infrastructure/claude", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/claude")>()),
  claudeAssetExtractor: () => ({ extract }),
}));
vi.mock("@/infrastructure/supabase/import-allowance", () => ({ supabaseImportAllowance: () => ({ check }) }));
vi.mock("@/infrastructure/supabase/org-usage", () => ({ supabaseOrgUsage: () => ({ read }) }));
vi.mock("@/infrastructure/supabase/org-billing", () => ({ supabaseOrgBilling: () => ({ get: async () => ({ customerId: "cus_1", subscriptionId: "sub_1", plan: "starter", seats: 2 }) }) }));
vi.mock("@/infrastructure/supabase/readers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/readers")>()),
  supabaseAssetTypeCatalog: () => ({ list: async () => [], tradeContext: async () => null }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  extract.mockClear();
  check.mockClear();
  read.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("the container and the plan limits", () => {
  test("C5126: the container's extractImport asks the allowance on a first chunk and a refusal stops Claude", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(await container.extractImport("66666666-6666-4666-8666-666666666666")).toMatchObject({ ok: false, code: "plan_limit", limit: 10, used: 10 });
    expect(check).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledTimes(0);
  });
});
