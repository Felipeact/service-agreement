import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { PLANS } from "@/domain/billing";
import { planLimitMessage } from "./plan-limits";

const MIGRATION = readFileSync(new URL("../../../supabase/migrations/20261112220000_plan_limits.sql", import.meta.url), "utf8");

describe("the seeded limits", () => {
  test("C5107: each plan's row in the migration equals the same plan in PLANS", () => {
    const seeded = [...MIGRATION.matchAll(/\('(\w+)',\s*(\d+),\s*(\d+)\)/g)].map(([, plan, agreements, imports]) => ({ plan, agreements: Number(agreements), imports: Number(imports) }));
    expect(seeded).toHaveLength(PLANS.length);
    for (const plan of PLANS) {
      expect(seeded.find((row) => row.plan === plan.key)).toEqual({ plan: plan.key, agreements: plan.liveAgreements, imports: plan.aiImports });
    }
  });
});

describe("planLimitMessage", () => {
  test("C5111: a manager reads the limit and gets the billing link, staff are told to ask", () => {
    const detail = { plan: "starter", limit: 15, used: 15 };
    expect(planLimitMessage("agreements", detail, "manager")).toEqual({
      message: "Your Starter plan allows 15 live agreements and you have 15.",
      billingHref: "/settings/billing",
    });
    const staff = planLimitMessage("agreements", detail, "staff");
    expect(staff.message).toBe("Your Starter plan allows 15 live agreements and you have 15. Ask an owner or admin to change the plan.");
    expect(staff.billingHref).toBeNull();
  });

  test("C5128: the import message names the allowance, the use and the reset date", () => {
    const notice = planLimitMessage("imports", { plan: "starter", limit: 10, used: 10, resetsOn: "2026-12-01" }, "manager");
    expect(notice.message).toBe("Your Starter plan allows 10 AI imports a month and you have used 10. The count resets on December 1.");
    expect(notice.billingHref).toBe("/settings/billing");
  });
});
