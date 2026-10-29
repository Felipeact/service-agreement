import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole, PortalLinkStore } from "@/application/ports";
import { makeReissueLink } from "@/application/use-cases";

// The tokens are checked against node:crypto here, not against the adapter that makes them.
const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");
const portalTokens = {
  create: () => {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: sha256(token) };
  },
  hash: sha256,
  // Reversible stand-ins for sealing: the real AES-GCM is proven in infrastructure/portal-tokens.test.ts.
  seal: (token: string) => `v1.${"A".repeat(16)}.${Buffer.from(token).toString("base64url")}`,
  unseal: (sealed: string) => Buffer.from(sealed.split(".")[2], "base64url").toString(),
};

const AGR = "11111111-1111-4111-8111-111111111111";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const reissue = vi.fn<PortalLinkStore["reissue"]>();

vi.mock("@/composition", () => ({
  getContainer: async () => ({ currentMember, reissueLink: makeReissueLink({ reissue }, portalTokens) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3000" }) }));

const { reissueLinkAction } = await import("./agreement-actions");

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("APP_BASE_URL", "https://agreements.example.com");
  currentMember.mockResolvedValue(member("estimator"));
  reissue.mockResolvedValue({ ok: true });
});

describe("reissueLinkAction", () => {
  test("C904: 200 with the new URL, whose token hashes to the hash given to the store", async () => {
    const state = await reissueLinkAction(AGR);
    expect(state.status).toBe("reissued");
    const url = (state as { url: string }).url;
    expect(url).toMatch(/^https:\/\/agreements\.example\.com\/review\/[\w-]{43}$/);
    const token = url.split("/review/")[1];
    const [id, hash] = reissue.mock.calls[0];
    expect(id).toBe(AGR);
    expect(hash).toBe(portalTokens.hash(token));
    expect(JSON.stringify(reissue.mock.calls[0])).not.toContain(token);
  });

  test.each(["conflict", "not_found", "forbidden"] as const)("C904: %s from the store is answered as it is", async (code) => {
    reissue.mockResolvedValue({ ok: false, code });
    expect(await reissueLinkAction(AGR)).toEqual({ status: code });
  });

  test("C904: a malformed id is not_found, an unexpected failure is unavailable", async () => {
    expect(await reissueLinkAction("nope")).toEqual({ status: "not_found" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    reissue.mockRejectedValue(new Error("down"));
    expect(await reissueLinkAction(AGR)).toEqual({ status: "unavailable" });
    log.mockRestore();
  });

  test("C906: a viewer gets forbidden and the store is not called", async () => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await reissueLinkAction(AGR)).toEqual({ status: "forbidden" });
    expect(reissue).not.toHaveBeenCalled();
  });
});
