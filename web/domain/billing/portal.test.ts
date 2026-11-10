import { describe, expect, test } from "vitest";
import { billingSection } from "./portal";

const ROLES = ["owner", "admin", "estimator", "viewer"] as const;

describe("the Billing section decision", () => {
  test.each(
    ROLES.flatMap((role) =>
      ([true, false] as const).flatMap((subscribed) => ([true, false] as const).map((configured) => ({ role, subscribed, configured }))),
    ),
  )("C2900: $role, subscription $subscribed, configured $configured", ({ role, subscribed, configured }) => {
    const view = billingSection({ role, plan: subscribed ? "team" : null, configured });
    const manager = role === "owner" || role === "admin";
    if (!manager || !subscribed) expect(view).toEqual({ kind: "hidden" });
    else expect(view).toEqual({ kind: configured ? "ready" : "unavailable", planName: "Team" });
  });

  test.each([
    ["starter", "Starter"],
    ["team", "Team"],
    ["business", "Business"],
  ] as const)("C2900: the %s plan is shown as %s", (plan, name) => {
    expect(billingSection({ role: "owner", plan, configured: true })).toEqual({ kind: "ready", planName: name });
  });
});
