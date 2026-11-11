import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ContractDocument } from "@/domain/contract";
import { makePortalTokens } from "@/infrastructure/portal-tokens";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

// Only what sits behind the use case is replaced: the database adapters and the layout engine. The provider adapter, the
// sealing and the use case are the real ones `getContainer()` builds from the environment.
const begin = vi.fn();
const complete = vi.fn();
const fail = vi.fn();
vi.mock("@/infrastructure/supabase/signing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/signing")>()),
  supabaseSignatureStore: () => ({ begin, complete, fail }),
}));
vi.mock("@/infrastructure/supabase/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/contracts")>()),
  supabaseContractReader: () => ({
    get: async () => ({
      id: "c1",
      status: "pending_signature",
      agreementId: "agr-1",
      versionNo: 1,
      number: "AG-1052",
      createdAt: new Date(),
      parties: {
        contractor: { legalName: "Kettle Ridge", address: null, phone: null },
        customer: { name: "Fernwood Dental" },
        site: { name: "Main", address: null },
        signer: { name: "Pat Lee", email: "pat@example.com" },
      },
    }),
  }),
}));
vi.mock("@/infrastructure/supabase/agreements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/agreements")>()),
  supabaseAgreementReader: () => ({ get: async () => ({ id: "agr-1" }) }),
}));
vi.mock("@/infrastructure/supabase/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/settings")>()),
  supabaseOrgSettingsStore: () => ({ get: async () => ({ accentColor: null }), save: async () => ({ ok: true }) }),
}));
vi.mock("@/infrastructure/supabase/org-logo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/supabase/org-logo")>()),
  supabaseOrgLogo: () => ({ current: async () => null, load: async () => null, prepareUpload: async () => ({ ok: false }), remove: async () => {}, url: () => null }),
}));
vi.mock("@/infrastructure/documents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/infrastructure/documents")>()),
  reactPdfContractRenderer: { renderContract: async () => new Uint8Array([1, 2, 3]) },
}));
vi.mock("@/domain/contract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domain/contract")>()),
  buildContractDocument: () => ({ number: "AG-1052", signer: { name: "Pat Lee", email: "pat@example.com" } }) as unknown as ContractDocument,
}));

const key = (byte: number) => Buffer.alloc(32, byte).toString("base64");
const fetchMock = vi.fn<typeof fetch>();
const input = { contractId: "c1", orgId: "org-1", contractorName: "Dana", contractorEmail: "dana@example.com", baseUrl: "https://app.test" };
const GOOD = {
  id: 13226499,
  submitters: [
    { id: 1, role: "Customer", embed_src: "https://docuseal.com/s/customer" },
    { id: 2, role: "Contractor", embed_src: "https://docuseal.com/s/contractor" },
  ],
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("PORTAL_LINK_KEY", key(1));
  vi.stubEnv("SIGNING_LINK_KEY", key(2));
  vi.stubEnv("DOCUSEAL_API_KEY", "docuseal-test-key");
  vi.stubEnv("DOCUSEAL_API_URL", "https://api.docuseal.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  begin.mockReset().mockResolvedValue({ ok: true, requestId: "req-1" });
  complete.mockReset().mockResolvedValue({ ok: true });
  fail.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function send() {
  const { getContainer } = await import("./index");
  return (await getContainer()).sendForSignature(input);
}

describe("getContainer's send for signature, with the real wiring", () => {
  test("C1717: with DOCUSEAL_API_KEY and DOCUSEAL_API_URL unset the answer is not_configured, the request is failed and DocuSeal is never called", async () => {
    vi.stubEnv("DOCUSEAL_API_KEY", "");
    vi.stubEnv("DOCUSEAL_API_URL", "");
    expect(await send()).toEqual({ ok: false, code: "not_configured" });
    expect(fail).toHaveBeenCalledWith("req-1");
    expect(complete).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([
    ["DOCUSEAL_API_KEY", "DOCUSEAL_API_URL"],
    ["DOCUSEAL_API_URL", "DOCUSEAL_API_KEY"],
  ])("C1717: with only %s unset (%s set) the answer is still not_configured and DocuSeal is never called", async (unset) => {
    vi.stubEnv(unset, "");
    expect(await send()).toEqual({ ok: false, code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C1717: with SIGNING_LINK_KEY unset the answer is unavailable before anything is begun, rendered or sent", async () => {
    vi.stubEnv("SIGNING_LINK_KEY", "");
    expect(await send()).toEqual({ ok: false, code: "unavailable" });
    expect(begin).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("C1717: the adapter is built from DOCUSEAL_API_URL and DOCUSEAL_API_KEY: the request goes to that address with that key, and a 422 is rejected", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 422 }));
    expect(await send()).toEqual({ ok: false, code: "rejected" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.docuseal.test/submissions/pdf");
    expect(new Headers(init?.headers).get("X-Auth-Token")).toBe("docuseal-test-key");
    expect(fail).toHaveBeenCalledWith("req-1");
  });

  test("C1717: on success the stored values are sealed with SIGNING_LINK_KEY and open with it, and the link is the customer's /sign address", async () => {
    fetchMock.mockResolvedValue(Response.json(GOOD));
    const result = await send();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.link).toMatch(/^https:\/\/app\.test\/sign\/[A-Za-z0-9_-]{43}$/);

    const [requestId, submissionId, signers, linkSealed] = complete.mock.calls[0];
    expect(requestId).toBe("req-1");
    expect(submissionId).toBe("13226499");
    const mine = makePortalTokens(key(2));
    expect(signers.map((s: { role: string; embedSealed: string }) => [s.role, mine.unseal(s.embedSealed)])).toEqual([
      ["customer", "https://docuseal.com/s/customer"],
      ["contractor", "https://docuseal.com/s/contractor"],
    ]);
    expect(`https://app.test/sign/${mine.unseal(linkSealed)}`).toBe(result.link);
    // The portal key opens none of them: one leak does not open the other family of links.
    expect(() => makePortalTokens(key(1)).unseal(linkSealed)).toThrow();
    expect(() => makePortalTokens(key(1)).unseal(signers[0].embedSealed)).toThrow();
  });
});
