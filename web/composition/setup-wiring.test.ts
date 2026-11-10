import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const isPending = vi.fn(async () => true);
const catalog = vi.fn(async () => [{ pack: "plumbing", name: "Sink" }]);
const saveProfile = vi.fn(async () => ({ ok: true as const }));
const skip = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/infrastructure/supabase/setup", () => ({ supabaseOrgSetup: () => ({ isPending, catalog, saveProfile, skip }) }));

afterEach(() => vi.unstubAllEnvs());

const webRoot = path.resolve(__dirname, "..");

describe("the container's setup store", () => {
  test("C2821: the container exposes the setup store, and the writes carry the clock's time", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();

    expect(await container.setupPending("org-1")).toBe(true);
    expect(isPending).toHaveBeenCalledWith("org-1");
    expect(await container.setupCatalog()).toEqual([{ pack: "plumbing", name: "Sink" }]);

    const before = Date.now();
    await container.skipSetup("org-1");
    const [skipOrg, skipAt] = skip.mock.calls[0] as unknown as [string, Date];
    expect(skipOrg).toBe("org-1");
    expect(skipAt.getTime()).toBeGreaterThanOrEqual(before - 1000);

    const profile = { legalName: "A", address: null, phone: null, accentColor: null, governingProvince: "BC", itemSingular: "unit", itemPlural: "units" };
    await container.saveSetupProfile("org-1", profile);
    const [saveOrg, saveValue, saveAt] = saveProfile.mock.calls[0] as unknown as [string, unknown, Date];
    expect([saveOrg, saveValue]).toEqual(["org-1", profile]);
    expect(saveAt).toBeInstanceOf(Date);
  });

  test("C2821: the Pipeline page and the setup page read the setup store from getContainer()", () => {
    expect(readFileSync(path.join(webRoot, "app/(app)/pipeline/page.tsx"), "utf8")).toMatch(/container\.setupPending\(/);
    expect(readFileSync(path.join(webRoot, "app/setup/page.tsx"), "utf8")).toMatch(/setupPending[\s\S]*= await getContainer\(\)|await getContainer\(\)/);
    expect(readFileSync(path.join(webRoot, "app/setup/page.tsx"), "utf8")).toMatch(/setupPending, getOrgSettings, setupCatalog/);
  });
});
