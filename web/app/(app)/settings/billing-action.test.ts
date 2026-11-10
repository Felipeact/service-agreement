import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const openBillingPortal = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, openBillingPortal }) }));
// Next's redirect() throws to stop the action; the double does the same, so code after it cannot run.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { openBillingPortalAction } = await import("./billing-actions");

const idle = { status: "idle" } as const;
const URL_OK = "https://billing.stripe.com/p/session/test_1";

const as = (role: "owner" | "admin" | "estimator" | "viewer") =>
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  vi.clearAllMocks();
  as("owner");
  openBillingPortal.mockResolvedValue({ ok: true, url: URL_OK });
});

describe("openBillingPortalAction", () => {
  test.each(["owner", "admin"] as const)("C2903: a signed-in %s is redirected to the url Stripe returned, after one portal call for their org", async (role) => {
    as(role);
    await expect(openBillingPortalAction(idle)).rejects.toThrow("NEXT_REDIRECT");
    expect(openBillingPortal).toHaveBeenCalledTimes(1);
    expect(openBillingPortal).toHaveBeenCalledWith({ orgId: "org-1", role });
    expect(redirect).toHaveBeenCalledWith(URL_OK);
  });

  test("C2905: browser fields change nothing sent to the portal, and the source never reads form data", async () => {
    const data = new FormData();
    for (const [name, value] of Object.entries({ customerId: "cus_attacker", customer: "cus_attacker", orgId: "org-evil", return_url: "https://evil.example" })) data.set(name, value);
    await expect((openBillingPortalAction as unknown as (s: unknown, f: FormData) => Promise<unknown>)(idle, data)).rejects.toThrow("NEXT_REDIRECT");
    expect(openBillingPortal).toHaveBeenCalledWith({ orgId: "org-1", role: "owner" });
    const source = readFileSync(path.join(__dirname, "billing-actions.ts"), "utf8");
    expect(source).not.toMatch(/formData|FormData/);
  });

  test.each(["estimator", "viewer"] as const)("C2908: a %s sees the permission text and no portal is opened", async (role) => {
    as(role);
    openBillingPortal.mockResolvedValue({ ok: false, code: "forbidden" });
    expect(await openBillingPortalAction(idle)).toEqual({ status: "forbidden" });
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2908: a signed-out visitor goes to /login and no portal is opened", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(openBillingPortalAction(idle)).rejects.toThrow("NEXT_REDIRECT /login");
    expect(openBillingPortal).not.toHaveBeenCalled();
  });

  test("C2908: a signed-in user with no membership goes to /login and no portal is opened", async () => {
    currentMember.mockResolvedValue({ status: "no_membership", email: "x@example.com" });
    await expect(openBillingPortalAction(idle)).rejects.toThrow("NEXT_REDIRECT /login");
    expect(openBillingPortal).not.toHaveBeenCalled();
  });

  test.each(["unavailable", "not_configured", "no_subscription"] as const)("C2911: a %s answer shows the unavailable notice and redirects nowhere", async (code) => {
    openBillingPortal.mockResolvedValue({ ok: false, code });
    expect(await openBillingPortalAction(idle)).toEqual({ status: "unavailable" });
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2912: a use case answering unavailable after a read failure is the same notice", async () => {
    openBillingPortal.mockResolvedValue({ ok: false, code: "unavailable" });
    expect(await openBillingPortalAction(idle)).toEqual({ status: "unavailable" });
  });
});
