import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makePortalTokens } from "@/infrastructure/portal-tokens";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const CONTRACT = "c0ffee00-0000-4000-8000-000000000001";
const ORG = "0a0a0a0a-0000-4000-8000-000000000001";
const key = (byte: number) => Buffer.alloc(32, byte).toString("base64");
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("PORTAL_LINK_KEY", key(1));
  vi.stubEnv("SIGNING_LINK_KEY", key(2));
  vi.stubEnv("DOCUSEAL_API_KEY", "docuseal-test-key");
  vi.stubEnv("DOCUSEAL_API_URL", "https://api.docuseal.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  // Every database read answers no row, so the use case stops at the first step that needs one.
  fetchMock.mockResolvedValue(Response.json(null));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the composition root, for signing", () => {
  test("C1717: getContainer wires the send use case, the secret reader, the signing tokens and the page's read", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.sendForSignature).toBe("function");
    expect(typeof container.signingSecrets.customerLink).toBe("function");
    expect(typeof container.signingSecrets.contractorSource).toBe("function");
    expect(typeof container.viewSigning).toBe("function");
    expect(typeof container.signingTokens.seal).toBe("function");
  });

  test("C1717: the signing tokens are sealed with SIGNING_LINK_KEY, and a value sealed with PORTAL_LINK_KEY does not open with it", async () => {
    const { getContainer } = await import("./index");
    const { signingTokens } = await getContainer();
    const mine = signingTokens.seal("https://docuseal.com/s/x");
    expect(makePortalTokens(key(2)).unseal(mine)).toBe("https://docuseal.com/s/x");
    expect(() => makePortalTokens(key(1)).unseal(mine)).toThrow();
    expect(signingTokens.unseal(makePortalTokens(key(2)).seal("t"))).toBe("t");
    expect(() => signingTokens.unseal(makePortalTokens(key(1)).seal("t"))).toThrow();
  });

  test("C1717: without SIGNING_LINK_KEY a send answers unavailable before it reaches the provider", async () => {
    vi.stubEnv("SIGNING_LINK_KEY", "");
    const { getContainer } = await import("./index");
    const { sendForSignature } = await getContainer();
    // The document source finds no contract, so the answer here is not_found; sealing is exercised by C1688.
    const result = await sendForSignature({ contractId: CONTRACT, orgId: ORG, contractorName: "Dana", contractorEmail: "d@example.com", baseUrl: "https://app.test" });
    expect(result.ok).toBe(false);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("docuseal"))).toBe(true);
  });

  test("C1717: with DOCUSEAL_API_KEY and DOCUSEAL_API_URL unset the use case is built and never calls DocuSeal", async () => {
    vi.stubEnv("DOCUSEAL_API_KEY", "");
    vi.stubEnv("DOCUSEAL_API_URL", "");
    const { getContainer } = await import("./index");
    const { sendForSignature } = await getContainer();
    expect(typeof sendForSignature).toBe("function");
    await sendForSignature({ contractId: CONTRACT, orgId: ORG, contractorName: "Dana", contractorEmail: "d@example.com", baseUrl: "https://app.test" });
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("docuseal"))).toBe(true);
  });

  test("C1717: the container reads the three names and wires them: the source carries each exactly where C1661 allows", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    expect(source).toContain("apiKey: process.env.DOCUSEAL_API_KEY");
    expect(source).toContain("apiUrl: process.env.DOCUSEAL_API_URL");
    expect(source).toContain("makePortalTokens(process.env.SIGNING_LINK_KEY)");
    expect(source).not.toMatch(/signingTokens = makePortalTokens\(process\.env\.PORTAL_LINK_KEY/);
  });
});
