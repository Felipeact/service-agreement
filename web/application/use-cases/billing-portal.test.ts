import { describe, expect, test, vi } from "vitest";
import type { BillingPortal, OrgBilling } from "@/application/ports";
import { makeBillingSection, makeOpenBillingPortal } from "./billing-portal";

const URL_OK = "https://billing.stripe.com/p/session/test_1";

function setup(overrides: { billing?: OrgBilling["get"]; portal?: BillingPortal["open"] } = {}) {
  const get = vi.fn(overrides.billing ?? (async () => ({ customerId: "cus_1", plan: "team" as const })));
  const open = vi.fn(overrides.portal ?? (async () => ({ ok: true as const, url: URL_OK })));
  return { get, open, billing: { get } as OrgBilling, portal: { open } as BillingPortal };
}

describe("opening the billing portal", () => {
  test.each(["owner", "admin"] as const)("C2903: a %s gets the portal url for the org's stored customer id", async (role) => {
    const { billing, portal, get, open } = setup();
    expect(await makeOpenBillingPortal(billing, portal)({ orgId: "org-1", role })).toEqual({ ok: true, url: URL_OK });
    expect(get).toHaveBeenCalledWith("org-1");
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({ customerId: "cus_1" });
  });

  test.each(["estimator", "viewer"] as const)("C2907: a %s is forbidden and nothing is read or called", async (role) => {
    const { billing, portal, get, open } = setup();
    expect(await makeOpenBillingPortal(billing, portal)({ orgId: "org-1", role })).toEqual({ ok: false, code: "forbidden" });
    expect(get).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  test("C2912: a database error on the billing read is unavailable and Stripe is not called", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { billing, portal, open } = setup({
      billing: async () => {
        throw new Error("Supabase error XX000: down with cus_secret");
      },
    });
    expect(await makeOpenBillingPortal(billing, portal)({ orgId: "org-1", role: "owner" })).toEqual({ ok: false, code: "unavailable" });
    expect(open).not.toHaveBeenCalled();
    expect(String(log.mock.calls.flat().join(" "))).not.toContain("cus_secret");
    log.mockRestore();
  });

  test("C2912: no org_billing row is no_subscription and Stripe is not called", async () => {
    const { billing, portal, open } = setup({ billing: async () => null });
    expect(await makeOpenBillingPortal(billing, portal)({ orgId: "org-1", role: "owner" })).toEqual({ ok: false, code: "no_subscription" });
    expect(open).not.toHaveBeenCalled();
  });

  test("C2903: the portal's own refusal passes through", async () => {
    const { billing, portal } = setup({ portal: async () => ({ ok: false as const, code: "not_configured" as const }) });
    expect(await makeOpenBillingPortal(billing, portal)({ orgId: "org-1", role: "admin" })).toEqual({ ok: false, code: "not_configured" });
  });
});

describe("reading the Billing section", () => {
  test("C2912: a database error hides the section instead of failing the page", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { billing } = setup({
      billing: async () => {
        throw new Error("Supabase error XX000: down");
      },
    });
    expect(await makeBillingSection(billing, true)("org-1", "owner")).toEqual({ kind: "hidden" });
    log.mockRestore();
  });

  test("C2907: a member who cannot manage billing never triggers the read", async () => {
    const { billing, get } = setup();
    expect(await makeBillingSection(billing, true)("org-1", "viewer")).toEqual({ kind: "hidden" });
    expect(get).not.toHaveBeenCalled();
  });

  test("C2903: an owner with a subscription gets the ready section for the stored plan", async () => {
    const { billing } = setup();
    expect(await makeBillingSection(billing, true)("org-1", "owner")).toEqual({ kind: "ready", planName: "Team" });
  });
});
