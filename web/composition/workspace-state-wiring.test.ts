import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

// The Supabase clients are replaced so their options and their rpc calls can be read; the adapters are the real ones.
const rpc = vi.fn();
const createClient = vi.fn<(url: string, key: string, options: unknown) => { rpc: typeof rpc }>(() => ({ rpc }));
const createServerClient = vi.fn<(url: string, key: string, options: unknown) => { rpc: typeof rpc }>(() => ({ rpc }));
vi.mock("@supabase/supabase-js", async (importOriginal) => ({ ...(await importOriginal<typeof import("@supabase/supabase-js")>()), createClient }));
vi.mock("@supabase/ssr", async (importOriginal) => ({ ...(await importOriginal<typeof import("@supabase/ssr")>()), createServerClient }));

const { getContainer, getWorkspaceStatusContainer } = await import("./index");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => vi.unstubAllEnvs());

describe("workspace state wiring", () => {
  test("C4222: the status read is built from a cookie-less anon client and asks checkout_workspace_status", async () => {
    rpc.mockResolvedValue({ data: "ready", error: null });
    const { workspaceStatus } = await getWorkspaceStatusContainer();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0]).toEqual(["https://example.supabase.co", "sb_publishable_test", { auth: { persistSession: false, autoRefreshToken: false } }]);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(await workspaceStatus.forSession("cs_test_1")).toBe("ready");
    expect(rpc).toHaveBeenCalledWith("checkout_workspace_status", { p_session_id: "cs_test_1" });
  });

  test("C4222: getContainer exposes workspaceState on the cookie client, which asks my_workspace_state", async () => {
    rpc.mockResolvedValue({ data: "pending", error: null });
    const container = await getContainer();
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(await container.workspaceState()).toBe("pending");
    expect(rpc).toHaveBeenCalledWith("my_workspace_state");
  });
});
