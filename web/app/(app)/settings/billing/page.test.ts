import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const loadBilling = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, loadBilling, stripePublishableKey: "pk_test_x" }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { default: BillingPage } = await import("./page");
const { BillingView } = await import("@/components/billing/billing-view");

const as = (role: "owner" | "admin" | "estimator" | "viewer") =>
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  vi.clearAllMocks();
  as("owner");
  loadBilling.mockResolvedValue({ kind: "ready", plan: "Team", overview: { status: "active" } });
});

describe("the billing page", () => {
  test.each(["estimator", "viewer"] as const)("C3111: a %s goes to /settings and nothing is read", async (role) => {
    as(role);
    loadBilling.mockResolvedValue({ kind: "forbidden" });
    await expect(BillingPage()).rejects.toThrow("NEXT_REDIRECT /settings");
  });

  test("C3111: a signed-out visitor goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(BillingPage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(loadBilling).not.toHaveBeenCalled();
  });

  test("C3111: a user with no membership goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "no_membership", email: "x@example.com" });
    await expect(BillingPage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(loadBilling).not.toHaveBeenCalled();
  });

  test.each(["owner", "admin"] as const)("C3110: a %s gets the view with the state read for their org and role", async (role) => {
    as(role);
    const element = (await BillingPage()) as { type: unknown; props: Record<string, unknown> };
    expect(loadBilling).toHaveBeenCalledWith({ orgId: "org-1", role });
    expect(element.type).toBe(BillingView);
    expect(element.props.state).toEqual({ kind: "ready", plan: "Team", overview: { status: "active" } });
    expect(element.props.publishableKey).toBe("pk_test_x");
  });

  test.each([
    [{ kind: "no_subscription" }],
    [{ kind: "not_configured" }],
    [{ kind: "error" }],
  ])("C3110: the state %j reaches the view unchanged", async (state) => {
    loadBilling.mockResolvedValue(state);
    const element = (await BillingPage()) as { props: Record<string, unknown> };
    expect(element.props.state).toEqual(state);
  });

  test("C3135: the page has a loading screen that names the page and says it is loading", async () => {
    expect(existsSync(path.join(__dirname, "loading.tsx"))).toBe(true);
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { default: Loading } = await import("./loading");
    const out = renderToStaticMarkup(createElement(Loading));
    expect(out).toContain("Billing");
    expect(out).toContain("Loading");
  });
});
