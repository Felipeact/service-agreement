import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CheckoutStarter } from "@/application/ports";
import { makeStartTrial } from "@/application/use-cases";
import { INITIAL_PRICING_STATE } from "./state";

const start = vi.fn<CheckoutStarter["start"]>();
vi.mock("@/composition", () => ({ getBillingContainer: async () => ({ startTrial: makeStartTrial({ start: (selection) => start(selection) }) }) }));
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const { startTrialAction } = await import("./actions");

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
      post([["plan", "team"], ["trade", "other"], ["trade", "hvac"], ["trade", "plumbing"], ["trade", "hvac"]]),
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ plan: "team", trades: ["hvac", "plumbing", "other"] });
  });

  test("C2415: an ok answer with an https url calls redirect once with that url", async () => {
    start.mockResolvedValue({ ok: true, url: "https://checkout.example.com/c/pay_1" });
    await expect(startTrialAction(INITIAL_PRICING_STATE, post([["plan", "business"], ["trade", "hvac"]]))).rejects.toThrow("NEXT_REDIRECT https://checkout.example.com/c/pay_1");
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("https://checkout.example.com/c/pay_1");
    expect(start).toHaveBeenCalledTimes(1);
  });

  test("C2420: a refusal carries the known trades it received and leaves a forged one out", async () => {
    const state = await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"], ["trade", "hvac"], ["trade", "fire"], ["trade", "other"]]));
    expect(state).toEqual({ status: "invalid_choice", trades: ["hvac", "other"] });
    expect(start).not.toHaveBeenCalled();

    const refused = await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"], ["trade", "other"], ["trade", "hvac"]]));
    expect(refused).toEqual({ status: "not_configured", trades: ["hvac", "other"] });
  });

  test("C2420: no trade is no_trade with no trades carried", async () => {
    expect(await startTrialAction(INITIAL_PRICING_STATE, post([["plan", "team"]]))).toEqual({ status: "no_trade", trades: [] });
  });
});
