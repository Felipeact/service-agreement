import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgBilling } from "@/application/ports";
import { PLAN_KEYS, type PlanKey } from "@/domain/billing";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** Reads what an org bought as the signed-in member, so `org_billing_select` (owner and admin) is the access rule (billing-portal door 1). */
export function supabaseOrgBilling(client: Client): OrgBilling {
  return {
    async get(orgId) {
      const { data, error } = await client.from("org_billing").select("stripe_customer_id, stripe_subscription_id, plan, seats").eq("org_id", orgId).maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (!data) return null;
      const plan = PLAN_KEYS.find((key): key is PlanKey => key === data.plan);
      if (!plan) throw new Error("Supabase error: org_billing holds an unknown plan");
      return { customerId: data.stripe_customer_id, subscriptionId: data.stripe_subscription_id, plan, seats: data.seats };
    },
  };
}
