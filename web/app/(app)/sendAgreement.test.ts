import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementRecord, AgreementRepository, AgreementSender, CurrentMember, MemberRole, PortalLinkStore } from "@/application/ports";
import { makeReissueLink, makeSendAgreement } from "@/application/use-cases";

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
const findById = vi.fn<AgreementRepository["findById"]>();
const send = vi.fn<AgreementSender["send"]>();
const commitTransition = vi.fn();
const requestHeaders = new Headers({ host: "localhost:3000" });

vi.mock("@/composition", () => ({
  getContainer: async () => ({
    currentMember,
    sendAgreement: makeSendAgreement({ findById, commitTransition } as unknown as AgreementRepository, { send }, portalTokens),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

const { sendAgreementAction } = await import("./agreement-actions");

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: "org-1", orgName: "Org", role });
const record = (status: AgreementRecord["status"]): AgreementRecord => ({ status, versionNo: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("APP_BASE_URL", "");
  currentMember.mockResolvedValue(member("estimator"));
  findById.mockResolvedValue(record("draft"));
  send.mockResolvedValue({ ok: true });
});

describe("sendAgreementAction", () => {
  test.each<MemberRole>(["owner", "admin", "estimator"])("C901: a %s gets 200 ok with <origin>/review/<token> whose token hashes to the stored hash", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const state = await sendAgreementAction(AGR);
    expect(state.status).toBe("sent");
    const url = (state as { url: string }).url;
    const token = url.replace("http://localhost:3000/review/", "");
    expect(url).toBe(`http://localhost:3000/review/${token}`);
    expect(token).toHaveLength(43);
    expect(send).toHaveBeenCalledTimes(1);
    const [id, hash, event] = send.mock.calls[0];
    expect(id).toBe(AGR);
    expect(hash).toBe(portalTokens.hash(token));
    expect(event).toMatchObject({ type: "agreement.sent", from: "draft", to: "sent" });
  });

  test("C901: APP_BASE_URL, when set, is the origin; a forwarded host and protocol otherwise", async () => {
    vi.stubEnv("APP_BASE_URL", "https://agreements.example.com/");
    expect(((await sendAgreementAction(AGR)) as { url: string }).url).toMatch(/^https:\/\/agreements\.example\.com\/review\/[\w-]{43}$/);
    vi.stubEnv("APP_BASE_URL", "");
    requestHeaders.set("x-forwarded-host", "app.example.com");
    requestHeaders.set("x-forwarded-proto", "https");
    try {
      expect(((await sendAgreementAction(AGR)) as { url: string }).url).toMatch(/^https:\/\/app\.example\.com\/review\//);
    } finally {
      requestHeaders.delete("x-forwarded-host");
      requestHeaders.delete("x-forwarded-proto");
    }
  });

  test("C902: no service lines answers no_lines and no link is shown", async () => {
    send.mockResolvedValue({ ok: false, code: "no_lines" });
    expect(await sendAgreementAction(AGR)).toEqual({ status: "no_lines" });
  });

  test("C903: an agreement that is not a draft answers conflict without calling the database, and so does a refusal from it", async () => {
    findById.mockResolvedValue(record("sent"));
    expect(await sendAgreementAction(AGR)).toEqual({ status: "conflict" });
    expect(send).not.toHaveBeenCalled();
    findById.mockResolvedValue(record("draft"));
    send.mockResolvedValue({ ok: false, code: "conflict" });
    expect(await sendAgreementAction(AGR)).toEqual({ status: "conflict" });
  });

  test("C903: a missing or malformed agreement is not_found", async () => {
    findById.mockResolvedValue(null);
    expect(await sendAgreementAction(AGR)).toEqual({ status: "not_found" });
    expect(await sendAgreementAction("nope")).toEqual({ status: "not_found" });
  });

  test("C906: a viewer gets forbidden and nothing is read or written", async () => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await sendAgreementAction(AGR)).toEqual({ status: "forbidden" });
    expect(findById).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("C901: an unexpected failure is unavailable and logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockRejectedValue(new Error("down"));
    expect(await sendAgreementAction(AGR)).toEqual({ status: "unavailable" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test("C907: the database gets the 64-character hash, never the token", async () => {
    const state = (await sendAgreementAction(AGR)) as { url: string };
    const token = state.url.split("/review/")[1];
    const args = send.mock.calls[0];
    expect(args[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain(token);
  });
});

describe("the sealed token (outbox-dispatch door 5)", () => {
  test("C1026: the send use case passes a sealed value whose unsealed token hashes to the hash argument", async () => {
    const state = (await sendAgreementAction(AGR)) as { url: string };
    const [, hash, , sealed] = send.mock.calls[0];
    expect(sealed).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    const token = portalTokens.unseal(sealed as string);
    expect(sha256(token)).toBe(hash);
    expect(state.url.endsWith(`/review/${token}`)).toBe(true);
  });

  test("C1026: the reissue use case passes a sealed value whose unsealed token hashes to the hash argument", async () => {
    const reissue = vi.fn<PortalLinkStore["reissue"]>(async () => ({ ok: true }));
    const result = await makeReissueLink({ reissue }, portalTokens)(AGR);
    const [id, hash, sealed] = reissue.mock.calls[0];
    expect(id).toBe(AGR);
    expect(sealed).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    const token = portalTokens.unseal(sealed as string);
    expect(sha256(token)).toBe(hash);
    expect(result).toEqual({ ok: true, token });
  });
});
