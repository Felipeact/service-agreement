import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const setupPending = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, setupPending }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { default: PipelinePage } = await import("./page");

const props = { searchParams: Promise.resolve({}) } as unknown as Parameters<typeof PipelinePage>[0];
const member = (role: "owner" | "admin" | "estimator" | "viewer"): CurrentMember => ({
  status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role,
});

beforeEach(() => {
  vi.clearAllMocks();
  setupPending.mockResolvedValue(true);
});

describe("Pipeline's first-login redirect", () => {
  test.each(["owner", "admin"] as const)("C2800: a %s of a pending org is redirected to /setup", async (role) => {
    currentMember.mockResolvedValue(member(role));
    await expect(PipelinePage(props)).rejects.toThrow("NEXT_REDIRECT /setup");
    expect(setupPending).toHaveBeenCalledWith("org-1");
  });

  test.each(["estimator", "viewer"] as const)("C2801: a %s of a pending org is not redirected", async (role) => {
    currentMember.mockResolvedValue(member(role));
    await expect(PipelinePage(props)).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2802: an owner of an org whose setup is done is not redirected", async () => {
    currentMember.mockResolvedValue(member("owner"));
    setupPending.mockResolvedValue(false);
    await expect(PipelinePage(props)).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2800: a pending read that fails counts as not pending, so Pipeline still renders", async () => {
    currentMember.mockResolvedValue(member("owner"));
    setupPending.mockRejectedValue(new Error("down"));
    await expect(PipelinePage(props)).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2802: a signed-out visitor is not redirected to /setup by this page", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(PipelinePage(props)).resolves.toBeTruthy();
    expect(setupPending).not.toHaveBeenCalled();
  });
});
