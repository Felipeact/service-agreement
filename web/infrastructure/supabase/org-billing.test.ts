import { describe, expect, test } from "vitest";
import { supabaseOrgBilling } from "./org-billing";
import { stubClient } from "./stub-client";

const ORG = "00000000-0000-4000-8000-00000000b111";

describe("the billing read", () => {
  test("C3129: selects only the customer id, the subscription id and the plan from org_billing for the org, on the given client", async () => {
    const { typed, calls } = stubClient({ org_billing: { data: [{ stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", plan: "team" }], error: null } });
    expect(await supabaseOrgBilling(typed).get(ORG)).toEqual({ customerId: "cus_1", subscriptionId: "sub_1", plan: "team" });
    expect([...new Set(calls.map((call) => call.table))]).toEqual(["org_billing"]);
    const select = calls.find((call) => call.method === "select");
    expect(String(select?.args[0]).split(",").map((column) => column.trim()).sort()).toEqual(["plan", "stripe_customer_id", "stripe_subscription_id"]);
    expect(calls.find((call) => call.method === "eq")?.args).toEqual(["org_id", ORG]);
    expect(calls.filter((call) => ["update", "insert", "delete"].includes(call.method))).toEqual([]);
  });

  test("C3129: no row is null", async () => {
    const { typed } = stubClient({ org_billing: { data: [], error: null } });
    expect(await supabaseOrgBilling(typed).get(ORG)).toBeNull();
  });

  test("C3129: a database error is thrown", async () => {
    const { typed } = stubClient({ org_billing: { data: null, error: { code: "XX000", message: "down" } } });
    await expect(supabaseOrgBilling(typed).get(ORG)).rejects.toThrow();
  });
});
