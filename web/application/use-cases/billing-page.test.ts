import { describe, expect, test, vi } from "vitest";
import type { BillingGateway, OrgBilling, OrgPlanRecorder } from "@/application/ports";
import type { BillingOverview } from "@/domain/billing/overview";
import { makeBilling, makeBillingEntry } from "./billing-page";

const OVERVIEW: BillingOverview = { status: "active", trialEnd: null, periodEnd: 1795547955, endsAt: null, plan: "team", extraSeats: 0, card: null, invoices: [] };
const IDS = { customerId: "cus_stored", subscriptionId: "sub_stored" };

function setup(over: { billing?: OrgBilling["get"]; gateway?: Partial<BillingGateway> } = {}) {
  const get = vi.fn(over.billing ?? (async () => ({ ...IDS, plan: "team" as const, seats: 5 })));
  const gateway = {
    overview: vi.fn(async () => ({ ok: true as const, overview: OVERVIEW })),
    startCardUpdate: vi.fn(async () => ({ ok: true as const, clientSecret: "seti_secret" })),
    finishCardUpdate: vi.fn(async () => ({ ok: true as const })),
    cancel: vi.fn(async () => ({ ok: true as const })),
    resume: vi.fn(async () => ({ ok: true as const })),
    ...over.gateway,
  } as unknown as { [K in keyof BillingGateway]: ReturnType<typeof vi.fn> } & BillingGateway;
  return { get, gateway, billing: makeBilling({ get } as OrgBilling, gateway, { record: vi.fn(async () => ({ ok: true as const })) } as unknown as OrgPlanRecorder) };
}

const member = (role: string) => ({ orgId: "org-1", role });
const writes = (gateway: ReturnType<typeof setup>["gateway"]) => [gateway.startCardUpdate, gateway.finishCardUpdate, gateway.cancel, gateway.resume];

describe("loading the billing page", () => {
  test.each(["owner", "admin"])("C3112: a %s gets the overview read with the stored ids and the plan name", async (role) => {
    const { billing, get, gateway } = setup();
    expect(await billing.load(member(role))).toEqual({ kind: "ready", plan: "Team", overview: OVERVIEW });
    expect(get).toHaveBeenCalledWith("org-1");
    expect(gateway.overview).toHaveBeenCalledTimes(1);
    expect(gateway.overview).toHaveBeenCalledWith(IDS);
  });

  test.each(["estimator", "viewer"])("C3112: a %s is forbidden and nothing is read", async (role) => {
    const { billing, get, gateway } = setup();
    expect(await billing.load(member(role))).toEqual({ kind: "forbidden" });
    expect(get).not.toHaveBeenCalled();
    expect(gateway.overview).not.toHaveBeenCalled();
  });

  test("C3112: no org_billing row is no_subscription and Stripe is not called", async () => {
    const { billing, gateway } = setup({ billing: async () => null });
    expect(await billing.load(member("owner"))).toEqual({ kind: "no_subscription" });
    expect(gateway.overview).not.toHaveBeenCalled();
  });

  test("C3112: a database error is an error and Stripe is not called", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { billing, gateway } = setup({
      billing: async () => {
        throw new Error("Supabase error XX000: down with cus_secret");
      },
    });
    expect(await billing.load(member("owner"))).toEqual({ kind: "error" });
    expect(gateway.overview).not.toHaveBeenCalled();
    expect(String(log.mock.calls.flat().join(" "))).not.toContain("cus_secret");
    log.mockRestore();
  });

  test("C3112: not configured and unavailable gateway answers pass through as their own states", async () => {
    expect(await setup({ gateway: { overview: vi.fn(async () => ({ ok: false as const, code: "not_configured" as const })) } }).billing.load(member("owner"))).toEqual({ kind: "not_configured" });
    expect(await setup({ gateway: { overview: vi.fn(async () => ({ ok: false as const, code: "unavailable" as const })) } }).billing.load(member("owner"))).toEqual({ kind: "error" });
  });
});

describe("the four actions", () => {
  const actions = [
    ["startCardUpdate", (b: ReturnType<typeof setup>["billing"], m: ReturnType<typeof member>) => b.startCardUpdate(m)],
    ["finishCardUpdate", (b: ReturnType<typeof setup>["billing"], m: ReturnType<typeof member>) => b.finishCardUpdate(m, "seti_1")],
    ["cancel", (b: ReturnType<typeof setup>["billing"], m: ReturnType<typeof member>) => b.cancel(m)],
    ["resume", (b: ReturnType<typeof setup>["billing"], m: ReturnType<typeof member>) => b.resume(m)],
  ] as const;

  test.each(actions.flatMap(([name, run]) => (["estimator", "viewer"] as const).map((role) => [name, role, run] as const)))(
    "C3123: %s as a %s is forbidden, reads nothing and writes nothing",
    async (_name, role, run) => {
      const { billing, get, gateway } = setup();
      expect(await run(billing, member(role))).toEqual({ ok: false, code: "forbidden" });
      expect(get).not.toHaveBeenCalled();
      for (const write of writes(gateway)) expect(write).not.toHaveBeenCalled();
    },
  );

  test.each(actions)("C3123: %s for an owner uses the ids stored for the org, never anything from the caller", async (name, run) => {
    const { billing, get, gateway } = setup();
    const result = await run(billing, member("owner"));
    expect(result.ok).toBe(true);
    expect(get).toHaveBeenCalledWith("org-1");
    const call = gateway[name].mock.calls[0];
    expect(call[0]).toEqual(IDS);
  });

  test.each(actions)("C3123: %s with a database error is unavailable and the gateway is not called", async (name, run) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { billing, gateway } = setup({
      billing: async () => {
        throw new Error("down");
      },
    });
    expect(await run(billing, member("owner"))).toEqual({ ok: false, code: "unavailable" });
    expect(gateway[name]).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test.each(actions)("C3123: %s with no subscription answers no_subscription and the gateway is not called", async (name, run) => {
    const { billing, gateway } = setup({ billing: async () => null });
    expect(await run(billing, member("owner"))).toEqual({ ok: false, code: "no_subscription" });
    expect(gateway[name]).not.toHaveBeenCalled();
  });

  test("C3123: starting a card update hands back the client secret", async () => {
    expect(await setup().billing.startCardUpdate(member("admin"))).toEqual({ ok: true, clientSecret: "seti_secret" });
  });

  test("C3136: a mismatch from finishing is passed on, and the use case itself writes nothing else", async () => {
    const { billing, gateway } = setup({ gateway: { finishCardUpdate: vi.fn(async () => ({ ok: false as const, code: "mismatch" as const })) } });
    expect(await billing.finishCardUpdate(member("owner"), "seti_1")).toEqual({ ok: false, code: "mismatch" });
    expect(gateway.finishCardUpdate).toHaveBeenCalledWith(IDS, "seti_1");
    for (const write of [gateway.startCardUpdate, gateway.cancel, gateway.resume]) expect(write).not.toHaveBeenCalled();
  });

  test("C3136: an unavailable from finishing is passed on", async () => {
    const { billing } = setup({ gateway: { finishCardUpdate: vi.fn(async () => ({ ok: false as const, code: "unavailable" as const })) } });
    expect(await billing.finishCardUpdate(member("owner"), "seti_1")).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("the Billing menu link", () => {
  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", false],
    ["viewer", false],
  ])("C3126: a %s with a billing record sees the link: %s", async (role, shown) => {
    expect(await makeBillingEntry({ get: async () => ({ ...IDS, plan: "team" as const, seats: 5 }) } as OrgBilling)("org-1", role)).toBe(shown);
  });

  test("C3126: no record, or a read that fails, shows no link", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await makeBillingEntry({ get: async () => null } as OrgBilling)("org-1", "owner")).toBe(false);
    expect(
      await makeBillingEntry({
        get: async () => {
          throw new Error("down");
        },
      } as OrgBilling)("org-1", "owner"),
    ).toBe(false);
    log.mockRestore();
  });
});
