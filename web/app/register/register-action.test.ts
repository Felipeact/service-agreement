import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CheckoutStarter, WorkspaceEmailCheck } from "@/application/ports";
import { makeStartTrial } from "@/application/use-cases";
import { INITIAL_PRICING_STATE } from "./state";

const start = vi.fn<CheckoutStarter["start"]>();
const inUse = vi.fn<WorkspaceEmailCheck["inUse"]>(async () => false);
vi.mock("@/composition", () => ({
  getBillingContainer: async () => ({ startTrial: makeStartTrial({ start: (selection) => start(selection) }, { inUse: (email) => inUse(email), companyInUse: async () => false }) }),
}));
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const { startTrialAction } = await import("./actions");

/** Valid contact fields; 10 seats are valid for every plan. */
const CONTACT: [string, string][] = [["email", "owner@shop.ca"], ["company", "Shop Ltd"], ["phone", "604-555-0199"], ["seats", "10"]];
const NORMAL = { seats: 10, email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199" };
const VALUES = { email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199", seats: "10" };

const post = (entries: [string, string | File][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  start.mockResolvedValue({ ok: false, code: "not_configured" });
});

describe("the pricing action", () => {
  test("C2414: repeated trade fields in shuffled order reach the starter once, de-duplicated and in order", async () => {
    await startTrialAction(
      INITIAL_PRICING_STATE,
      post([["plan", "team"], ["trade", "other"], ["trade", "hvac"], ["trade", "plumbing"], ["trade", "hvac"], ...CONTACT]),
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ plan: "team", trades: ["hvac", "plumbing", "other"], ...NORMAL });
  });

  test("C2415: an ok answer with an https url calls redirect once with that url", async () => {
    start.mockResolvedValue({ ok: true, url: "https://checkout.example.com/c/pay_1" });
    await expect(startTrialAction(INITIAL_PRICING_STATE, post([["plan", "business"], ["trade", "hvac"], ...CONTACT]))).rejects.toThrow("NEXT_REDIRECT https://checkout.example.com/c/pay_1");
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("https://checkout.example.com/c/pay_1");
    expect(start).toHaveBeenCalledTimes(1);
  });

  test("C2420: a refusal carries the known trades it received and leaves a forged one out", async () => {
    const state = await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"], ["trade", "hvac"], ["trade", "fire"], ["trade", "other"], ...CONTACT]));
    expect(state).toEqual({ status: "invalid_choice", trades: ["hvac", "other"], values: { plan: "team", ...VALUES }, fields: {} });
    expect(start).not.toHaveBeenCalled();

    const refused = await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"], ["trade", "other"], ["trade", "hvac"], ...CONTACT]));
    expect(refused).toEqual({ status: "not_configured", trades: ["hvac", "other"], values: { plan: "team", ...VALUES }, fields: {} });
  });

  test("C2420: an unavailable starter is the unavailable state carrying the known trades", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    start.mockResolvedValue({ ok: false, code: "unavailable" });
    expect(await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"], ["trade", "plumbing"], ...CONTACT]))).toEqual({
      status: "unavailable",
      trades: ["plumbing"],
      values: { plan: "team", ...VALUES },
      fields: {},
    });

    start.mockRejectedValue(new Error("down"));
    expect(await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"], ["trade", "hvac"], ...CONTACT]))).toMatchObject({ status: "unavailable", trades: ["hvac"] });
    errorSpy.mockRestore();
  });

  test("C2420: no trade is no_trade with no trades carried", async () => {
    expect(await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"], ...CONTACT]))).toEqual({
      status: "no_trade",
      trades: [],
      values: { plan: "team", ...VALUES },
      fields: {},
    });
  });

  test("C2606: a bad email and phone come back as invalid_details with both fields and every typed value", async () => {
    const state = await startTrialAction(
      INITIAL_PRICING_STATE,
      post([["plan", "starter"], ["trade", "hvac"], ["email", "nope"], ["company", "Shop Ltd"], ["phone", "12"], ["seats", "3"]]),
    );
    expect(state).toEqual({
      status: "invalid_details",
      trades: ["hvac"],
      values: { plan: "starter", email: "nope", company: "Shop Ltd", phone: "12", seats: "3" },
      fields: { email: true, phone: true },
    });
    expect(start).not.toHaveBeenCalled();
  });

  test("C4309: a taken email is exactly the email_in_use state with the email field marked and nothing about the account", async () => {
    inUse.mockResolvedValue(true);
    const state = await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"], ["trade", "hvac"], ...CONTACT]));
    expect(state).toEqual({ status: "email_in_use", trades: ["hvac"], values: { plan: "team", ...VALUES }, fields: { email: true } });
    expect(start).not.toHaveBeenCalled();
  });
});
