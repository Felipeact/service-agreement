import { describe, expect, test, vi } from "vitest";
import type { BillingGateway, OrgBilling, OrgPlanRecorder, OrgUsageReader } from "@/application/ports";
import type { BillingOverview } from "@/domain/billing/overview";
import type { OrgUsage } from "@/domain/billing/plan-limits";
import { makeBilling } from "./billing-page";

const OVERVIEW: BillingOverview = { status: "active", trialEnd: null, periodEnd: 1795547955, endsAt: null, plan: "team", extraSeats: 0, card: null, invoices: [] };
const USAGE: OrgUsage = { plan: "team", liveAgreements: { used: 7, limit: 60 }, aiImports: { used: 3, limit: 40 }, resetsOn: "2026-12-01" };

function setup(read: OrgUsageReader["read"]) {
  const gateway = { overview: vi.fn(async () => ({ ok: true as const, overview: OVERVIEW })) } as unknown as BillingGateway;
  const usage = { read: vi.fn(read) };
  const billing = makeBilling(
    { get: vi.fn(async () => ({ customerId: "cus_1", subscriptionId: "sub_1", plan: "team" as const, seats: 5 })) } as unknown as OrgBilling,
    gateway,
    { record: vi.fn() } as unknown as OrgPlanRecorder,
    usage,
  );
  return { billing, usage };
}

const owner = { orgId: "org-1", role: "owner" };

describe("the billing page and usage", () => {
  test("C5145: usage reads the member's own usage once and returns it; the Stripe page load is unchanged", async () => {
    const { billing, usage } = setup(async () => USAGE);
    expect(await billing.usage(owner)).toEqual(USAGE);
    expect(usage.read).toHaveBeenCalledTimes(1);
    expect(await billing.load(owner)).toEqual({ kind: "ready", plan: "Team", overview: OVERVIEW });
    expect(usage.read).toHaveBeenCalledTimes(1);
  });

  test("C5145: a usage read that fails or throws is null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await setup(async () => null).billing.usage(owner)).toBeNull();
    const thrown = setup(async () => {
      throw new Error("down");
    });
    expect(await thrown.billing.usage(owner)).toBeNull();
  });

  test("C5145: a member who may not see billing triggers no usage read", async () => {
    const { billing, usage } = setup(async () => USAGE);
    expect(await billing.usage({ orgId: "org-1", role: "estimator" })).toBeNull();
    expect(usage.read).toHaveBeenCalledTimes(0);
  });
});
