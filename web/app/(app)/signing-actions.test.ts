import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole, SendForSignatureResult } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const sendForSignature = vi.fn<(input: unknown) => Promise<SendForSignatureResult>>();
const container = { currentMember, sendForSignature };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
const revalidatePath = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("./link-base", () => ({ linkBase: async () => "https://app.test" }));

const { sendForSignatureAction } = await import("./signing-actions");

const CON = "66666666-6666-4666-8666-666666666666";
const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "dana@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  currentMember.mockReset().mockResolvedValue(member("owner"));
  sendForSignature.mockReset().mockResolvedValue({ ok: true, link: "https://app.test/sign/t" });
  redirect.mockClear();
  revalidatePath.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendForSignatureAction", () => {
  test("C1691: a signed-out visitor is redirected to /login and nothing is sent", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(sendForSignatureAction(CON, "Dana")).rejects.toThrow("NEXT_REDIRECT /login");
    expect(sendForSignature).not.toHaveBeenCalled();
  });

  test.each<MemberRole>(["estimator", "viewer"])("C1691: an %s is forbidden and the use case is not called", async (role) => {
    currentMember.mockResolvedValue(member(role));
    expect(await sendForSignatureAction(CON, "Dana")).toEqual({ status: "forbidden" });
    expect(sendForSignature).not.toHaveBeenCalled();
  });

  test.each(["abc", ""])("C1691: the malformed id %j is not_found and the use case is not called", async (id) => {
    expect(await sendForSignatureAction(id, "Dana")).toEqual({ status: "not_found" });
    expect(sendForSignature).not.toHaveBeenCalled();
  });

  test.each<MemberRole>(["owner", "admin"])("C1691: a %s sends once, with the trimmed name, their own org and email, and the link base", async (role) => {
    currentMember.mockResolvedValue(member(role));
    expect(await sendForSignatureAction(CON, "  Dana Admin  ")).toEqual({ status: "sent" });
    expect(sendForSignature).toHaveBeenCalledTimes(1);
    expect(sendForSignature).toHaveBeenCalledWith({
      contractId: CON,
      orgId: "org-1",
      contractorName: "Dana Admin",
      contractorEmail: "dana@example.com",
      baseUrl: "https://app.test",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/contracts/${CON}`);
  });

  test.each(["rejected", "unavailable", "not_configured", "already_open", "not_pending", "invalid_name"] as const)(
    "C1691: the use case's %s is the action's status and nothing is revalidated",
    async (code) => {
      sendForSignature.mockResolvedValue({ ok: false, code });
      expect(await sendForSignatureAction(CON, "Dana")).toEqual({ status: code });
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  test("C1691: a use case that throws is unavailable", async () => {
    sendForSignature.mockRejectedValue(new Error("boom"));
    expect(await sendForSignatureAction(CON, "Dana")).toEqual({ status: "unavailable" });
  });
});
