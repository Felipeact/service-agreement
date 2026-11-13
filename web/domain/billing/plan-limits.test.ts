import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { PLANS } from "@/domain/billing";
import { formatTokens, planLimitMessage, remaining } from "./plan-limits";

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

  test("C5111: the limit and the count are told apart when a downgrade leaves the org over its limit", () => {
    expect(planLimitMessage("agreements", { plan: "starter", limit: 15, used: 17 }, "manager").message).toBe("Your Starter plan allows 15 live agreements and you have 17.");
  });

  test("C5128: the allowance and the use are told apart", () => {
    expect(planLimitMessage("imports", { plan: "team", limit: 40, used: 42, resetsOn: "2027-01-01" }, "manager").message).toBe(
      "Your Team plan allows 40 AI imports a month and you have used 42. The count resets on January 1.",
    );
  });

  test("C5128: the import message names the allowance, the use and the reset date", () => {
    const notice = planLimitMessage("imports", { plan: "starter", limit: 10, used: 10, resetsOn: "2026-12-01" }, "manager");
    expect(notice.message).toBe("Your Starter plan allows 10 AI imports a month and you have used 10. The count resets on December 1.");
    expect(notice.billingHref).toBe("/settings/billing");
  });
});

describe("what is left and the tokens line", () => {
  test("what is left of a limit never goes below zero, and is null with no limit", () => {
    expect(remaining({ used: 3, limit: 10 })).toBe(7);
    expect(remaining({ used: 12, limit: 10 })).toBe(0);
    expect(remaining({ used: 3, limit: null })).toBeNull();
  });

  test("tokens read as one total with thousands separators", () => {
    expect(formatTokens({ input: 21000, output: 30200 })).toBe("51,200 tokens");
    expect(formatTokens({ input: 1, output: 0 })).toBe("1 token");
    expect(formatTokens({ input: 0, output: 0 })).toBe("0 tokens");
  });
});
