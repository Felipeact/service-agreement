import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";
import { BILLING_MESSAGES } from "@/components/billing/state";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const startCardUpdate = vi.fn();
const finishCardUpdate = vi.fn();
const cancelSubscription = vi.fn();
const resumeSubscription = vi.fn();
const changePlan = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, startCardUpdate, finishCardUpdate, cancelSubscription, resumeSubscription, changePlan }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const actions = await import("./actions");

const as = (role: "owner" | "admin" | "estimator" | "viewer") =>
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  vi.clearAllMocks();
  as("owner");
  startCardUpdate.mockResolvedValue({ ok: true, clientSecret: "seti_secret" });
  finishCardUpdate.mockResolvedValue({ ok: true });
  cancelSubscription.mockResolvedValue({ ok: true });
  resumeSubscription.mockResolvedValue({ ok: true });
});

const run = {
  startCardUpdate: () => actions.startCardUpdateAction(),
  finishCardUpdate: () => actions.finishCardUpdateAction("seti_1AbC"),
  cancelSubscription: () => actions.cancelSubscriptionAction(),
  resumeSubscription: () => actions.resumeSubscriptionAction(),
} as const;
const useCases = { startCardUpdate, finishCardUpdate, cancelSubscription, resumeSubscription } as const;
const names = Object.keys(run) as (keyof typeof run)[];

describe("the billing Server Actions", () => {
  test.each(names)("C3124: %s redirects a signed-out visitor to /login without calling the use case", async (name) => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(run[name]()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(useCases[name]).not.toHaveBeenCalled();
  });

  test.each(names)("C3124: %s redirects a user with no membership to /login without calling the use case", async (name) => {
    currentMember.mockResolvedValue({ status: "no_membership", email: "x@example.com" });
    await expect(run[name]()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(useCases[name]).not.toHaveBeenCalled();
  });

  test("C3124: the three argument-less actions pass only the session's org and role", async () => {
    await actions.startCardUpdateAction();
    await actions.cancelSubscriptionAction();
    await actions.resumeSubscriptionAction();
    for (const useCase of [startCardUpdate, cancelSubscription, resumeSubscription]) expect(useCase).toHaveBeenCalledWith({ orgId: "org-1", role: "owner" });
    expect(actions.startCardUpdateAction.length).toBe(0);
    expect(actions.cancelSubscriptionAction.length).toBe(0);
    expect(actions.resumeSubscriptionAction.length).toBe(0);
  });

  test("C3124: finishing passes the session's org and role and only the SetupIntent id", async () => {
    await actions.finishCardUpdateAction("seti_1AbC");
    expect(finishCardUpdate).toHaveBeenCalledWith({ orgId: "org-1", role: "owner" }, "seti_1AbC");
  });

  test.each(["", "pi_123", "seti_", "seti_1 2", "seti_1;drop", "SETI_1", "cus_1", " seti_1", "seti_1\n"])(
    "C3124: finishing with %j is the card notice and the use case is not called",
    async (value) => {
      expect(await actions.finishCardUpdateAction(value)).toEqual({ status: "failed" });
      expect(finishCardUpdate).not.toHaveBeenCalled();
    },
  );

  test("C3124: no action reads form data", () => {
    const source = readFileSync(path.join(__dirname, "actions.ts"), "utf8");
    expect(source).not.toMatch(/formData|FormData/);
  });
});

describe("what each action answers", () => {
  test("C3125: a started card update answers the client secret", async () => {
    expect(await actions.startCardUpdateAction()).toEqual({ status: "ready", clientSecret: "seti_secret" });
  });

  test.each([
    ["forbidden", { ok: false, code: "forbidden" }, "forbidden"],
    ["unavailable", { ok: false, code: "unavailable" }, "unavailable"],
    ["not_configured", { ok: false, code: "not_configured" }, "unavailable"],
    ["no_subscription", { ok: false, code: "no_subscription" }, "unavailable"],
  ])("C3125: starting a card update that is %s answers %s", async (_name, answer, status) => {
    startCardUpdate.mockResolvedValue(answer);
    expect(await actions.startCardUpdateAction()).toEqual({ status });
  });

  test("C3125: finishing answers saved on success", async () => {
    expect(await actions.finishCardUpdateAction("seti_1AbC")).toEqual({ status: "saved" });
  });

  test.each([
    [{ ok: false, code: "forbidden" }, "forbidden"],
    [{ ok: false, code: "mismatch" }, "failed"],
    [{ ok: false, code: "unavailable" }, "failed"],
    [{ ok: false, code: "no_subscription" }, "failed"],
    [{ ok: false, code: "not_configured" }, "failed"],
  ])("C3125: finishing with %j answers %s", async (answer, status) => {
    finishCardUpdate.mockResolvedValue(answer);
    expect(await actions.finishCardUpdateAction("seti_1AbC")).toEqual({ status });
  });

  test.each(["cancelSubscription", "resumeSubscription"] as const)("C3125: %s answers done on success", async (name) => {
    expect(await run[name]()).toEqual({ status: "done" });
  });

  test.each(["cancelSubscription", "resumeSubscription"] as const)("C3125: %s answers forbidden and unavailable", async (name) => {
    useCases[name].mockResolvedValue({ ok: false, code: "forbidden" });
    expect(await run[name]()).toEqual({ status: "forbidden" });
    useCases[name].mockResolvedValue({ ok: false, code: "unavailable" });
    expect(await run[name]()).toEqual({ status: "unavailable" });
  });

  test("C3125: the notices are the ones the plan names", () => {
    expect(BILLING_MESSAGES.forbidden).toBe("You don't have permission to change this");
    expect(BILLING_MESSAGES.unavailable).toBe("We couldn't update your subscription. Try again.");
    expect(BILLING_MESSAGES.card).toBe("We couldn't update your card");
  });
});

describe("the change-plan Server Action", () => {
  beforeEach(() => changePlan.mockResolvedValue({ ok: true }));

  test.each(["signed_out", "no_membership"] as const)("C3210: a %s user goes to /login and the use case is not called", async (status) => {
    currentMember.mockResolvedValue(status === "signed_out" ? { status } : { status, email: "x@example.com" });
    await expect(actions.changePlanAction("team")).rejects.toThrow("NEXT_REDIRECT /login");
    expect(changePlan).not.toHaveBeenCalled();
  });

  test.each(["starter", "team", "business"])("C3210: the plan %s goes to the use case with the session's org and role", async (key) => {
    expect(await actions.changePlanAction(key)).toEqual({ status: "done" });
    expect(changePlan).toHaveBeenCalledWith({ orgId: "org-1", role: "owner" }, key);
  });

  test.each(["platinum", "", "TEAM", " team", "constructor", "__proto__", "team\n"])("C3210: the key %j answers the plan notice and the use case is not called", async (key) => {
    expect(await actions.changePlanAction(key)).toEqual({ status: "failed" });
    expect(changePlan).not.toHaveBeenCalled();
  });

  test.each([
    [{ ok: false, code: "forbidden" }, "forbidden"],
    [{ ok: false, code: "same_plan" }, "same_plan"],
    [{ ok: false, code: "invalid" }, "failed"],
    [{ ok: false, code: "unavailable" }, "failed"],
    [{ ok: false, code: "not_configured" }, "failed"],
    [{ ok: false, code: "no_subscription" }, "failed"],
    [{ ok: false, code: "unsupported" }, "failed"],
  ])("C3210: the use case answering %j gives the page state %s", async (answer, status) => {
    changePlan.mockResolvedValue(answer);
    expect(await actions.changePlanAction("team")).toEqual({ status });
  });

  test("C3210: the action takes exactly one argument, reads no form data, and the notices are the ones named", () => {
    expect(actions.changePlanAction.length).toBe(1);
    expect(BILLING_MESSAGES.forbidden).toBe("You don't have permission to change this");
    expect(BILLING_MESSAGES.samePlan).toBe("You're already on this plan");
    expect(BILLING_MESSAGES.plan).toBe("We couldn't change your plan. Try again.");
  });
});
