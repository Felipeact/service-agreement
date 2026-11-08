import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

// Only the Supabase client is replaced, so its options and its rpc calls can be read. The use case, the Supabase adapter
// and the DocuSeal file adapter are the real ones `getWebhookContainer()` builds from the environment.
const rpc = vi.fn();
const createClient = vi.fn<(url: string, key: string, options: unknown) => { rpc: typeof rpc }>(() => ({ rpc }));
vi.mock("@supabase/supabase-js", async (importOriginal) => ({ ...(await importOriginal<typeof import("@supabase/supabase-js")>()), createClient }));

const { getWebhookContainer } = await import("./index");

const fetchMock = vi.fn<typeof fetch>();
const URLS = [
  { kind: "signed", url: "https://docuseal.com/file/a/document.pdf" },
  { kind: "audit_log", url: "https://docuseal.com/file/a/audit-log.pdf" },
];
const DELIVERY = { body: '{"event_type":"submission.completed"}', signature: `1790000000.${"d".repeat(64)}` };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("DOCUSEAL_API_KEY", "");
  vi.stubEnv("DOCUSEAL_API_URL", "");
  vi.stubEnv("SIGNING_LINK_KEY", "");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async () => new Response(new TextEncoder().encode("%PDF-1.4 file")));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the webhook container", () => {
  test("C1772: it is built from the two public Supabase names alone, with no DocuSeal key and no signing key", async () => {
    const { receive } = await getWebhookContainer();
    expect(typeof receive).toBe("function");
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0].slice(0, 2)).toEqual(["https://example.supabase.co", "sb_publishable_test"]);
  });

  test("C1772: the client it makes keeps no session and refreshes no token", async () => {
    await getWebhookContainer();
    expect(createClient.mock.calls[0][2]).toEqual({ auth: { persistSession: false, autoRefreshToken: false } });
  });

  test("C1772: a final event runs end to end, and the file requests carry no key", async () => {
    rpc.mockResolvedValueOnce({ data: { outcome: "documents_needed", documents: URLS }, error: null });
    rpc.mockResolvedValueOnce({ data: { outcome: "applied" }, error: null });
    const { receive } = await getWebhookContainer();
    expect(await receive(DELIVERY)).toEqual({ ok: true, outcome: "applied" });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(URLS.map((entry) => entry.url));
    for (const [, init] of fetchMock.mock.calls) expect(JSON.stringify(init)).not.toMatch(/X-Auth-Token|Authorization/i);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1].p_documents).toEqual([
      { kind: "signed", content: Buffer.from("%PDF-1.4 file").toString("base64") },
      { kind: "audit_log", content: Buffer.from("%PDF-1.4 file").toString("base64") },
    ]);
  });

  test("C1772: without the public Supabase names the container refuses to build", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(getWebhookContainer()).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});
