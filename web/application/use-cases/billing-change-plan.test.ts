import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { BillingGateway, OrgBilling, OrgPlanRecorder } from "@/application/ports";
import type { PlanKey } from "@/domain/billing";
import { makeBilling } from "./billing-page";

const IDS = { customerId: "cus_stored", subscriptionId: "sub_stored" };
const member = (role: string) => ({ orgId: "org-1", role });

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorLog.mockRestore());

function setup(over: { stored?: { plan: PlanKey; seats: number } | null | Error; gateway?: BillingGateway["changePlan"]; recorder?: OrgPlanRecorder["record"] } = {}) {
  const stored = over.stored === undefined ? { plan: "starter" as PlanKey, seats: 2 } : over.stored;
  const get = vi.fn(async () => {
    if (stored instanceof Error) throw stored;
    return stored ? { ...IDS, plan: stored.plan, seats: stored.seats } : null;
  });
  const changePlan = vi.fn(over.gateway ?? (async () => ({ ok: true as const, changed: true })));
  const record = vi.fn(over.recorder ?? (async () => ({ ok: true as const })));
  const gateway = { changePlan } as unknown as BillingGateway;
  const billing = makeBilling({ get } as unknown as OrgBilling, gateway, { record } as OrgPlanRecorder);
  return { billing, get, changePlan, record };
}

describe("changing the plan", () => {
  test.each(["owner", "admin"])("C3209: a %s changes the plan with the stored ids, the extra seats the new plan needs, then records plan and seats", async (role) => {
    const { billing, get, changePlan, record } = setup();
    expect(await billing.changePlan(member(role), "team")).toEqual({ ok: true });
    expect(get).toHaveBeenCalledWith("org-1");
    expect(changePlan).toHaveBeenCalledTimes(1);
    expect(changePlan).toHaveBeenCalledWith(IDS, { plan: "team", extraSeats: 0 });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith("team", 5);
  });

  test("C3209: the seat count follows the sign-up rule, and the extra seats are what the new plan does not include", async () => {
    const { billing, changePlan, record } = setup({ stored: { plan: "team", seats: 7 } });
    expect(await billing.changePlan(member("owner"), "starter")).toEqual({ ok: true });
    expect(changePlan).toHaveBeenCalledWith(IDS, { plan: "starter", extraSeats: 5 });
    expect(record).toHaveBeenCalledWith("starter", 7);
  });

  test.each(["estimator", "viewer"])("C3209: a %s is forbidden and nothing is read, changed or recorded", async (role) => {
    const { billing, get, changePlan, record } = setup();
    expect(await billing.changePlan(member(role), "team")).toEqual({ ok: false, code: "forbidden" });
    expect(get).not.toHaveBeenCalled();
    expect(changePlan).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test.each(["platinum", "", "TEAM", "team ", "constructor", "__proto__"])("C3209: the key %j is invalid and nothing is called", async (key) => {
    const { billing, changePlan, record } = setup();
    expect(await billing.changePlan(member("owner"), key)).toEqual({ ok: false, code: "invalid" });
    expect(changePlan).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test("C3209: Stripe already on the plan and our record agreeing is same_plan: one read at Stripe, no write, nothing recorded", async () => {
    const { billing, changePlan, record } = setup({ stored: { plan: "team", seats: 5 }, gateway: async () => ({ ok: true as const, changed: false }) });
    expect(await billing.changePlan(member("owner"), "team")).toEqual({ ok: false, code: "same_plan" });
    expect(changePlan).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
  });

  test("C3209: our record already saying the plan while Stripe is on another still changes Stripe and records", async () => {
    const { billing, changePlan, record } = setup({ stored: { plan: "team", seats: 5 } });
    expect(await billing.changePlan(member("owner"), "team")).toEqual({ ok: true });
    expect(changePlan).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith("team", 5);
  });

  test("C3209: no org_billing row is no_subscription and Stripe is not called", async () => {
    const { billing, changePlan } = setup({ stored: null });
    expect(await billing.changePlan(member("owner"), "team")).toEqual({ ok: false, code: "no_subscription" });
    expect(changePlan).not.toHaveBeenCalled();
  });

  test("C3209: a database error is unavailable and Stripe is not called", async () => {
    const { billing, changePlan, record } = setup({ stored: new Error("down with cus_secret") });
    expect(await billing.changePlan(member("owner"), "team")).toEqual({ ok: false, code: "unavailable" });
    expect(changePlan).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(String(errorLog.mock.calls.flat().join(" "))).not.toContain("cus_secret");
  });

  test.each(["unavailable", "not_configured", "unsupported"] as const)("C3209: a gateway answer of %s is passed on and nothing is recorded", async (code) => {
    const { billing, record } = setup({ gateway: async () => ({ ok: false as const, code }) });
    expect(await billing.changePlan(member("owner"), "team")).toEqual({ ok: false, code });
    expect(record).not.toHaveBeenCalled();
  });

  test.each(["forbidden", "not_found", "unavailable"] as const)("C3209: a recording failure (%s) after Stripe changed still answers ok and the use case logs nothing itself", async (code) => {
    const { billing, record } = setup({ recorder: async () => ({ ok: false as const, code }) });
    expect(await billing.changePlan(member("owner"), "team")).toEqual({ ok: true });
    expect(record).toHaveBeenCalledTimes(1);
    expect(errorLog).not.toHaveBeenCalled();
  });

  test("C3209: Stripe already on the plan while org_billing differs is recorded and answers ok", async () => {
    const { billing, record } = setup({ stored: { plan: "starter", seats: 2 }, gateway: async () => ({ ok: true as const, changed: false }) });
    expect(await billing.changePlan(member("owner"), "team")).toEqual({ ok: true });
    expect(record).toHaveBeenCalledWith("team", 5);
  });
});
