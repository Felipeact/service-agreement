import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgPlanRecorder } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/**
 * Records the plan and seat count of the signed-in member's org through `set_org_plan` (plan-change door 2). The function checks the
 * role itself; `42501` is not an owner or admin and `P0002` is no billing record. A failure is logged by its code only.
 */
export function supabaseOrgPlanRecorder(client: Client): OrgPlanRecorder {
  return {
    async record(plan, seats) {
      try {
        const { error } = await client.rpc("set_org_plan", { p_plan: plan, p_seats: seats });
        if (!error) return { ok: true };
        console.error(`Recording the plan failed: ${error.code}`);
        if (error.code === "42501") return { ok: false, code: "forbidden" };
        if (error.code === "P0002") return { ok: false, code: "not_found" };
        return { ok: false, code: "unavailable" };
      } catch (cause) {
        console.error(`Recording the plan failed: ${cause instanceof Error ? cause.name : "a non-error"}`);
        return { ok: false, code: "unavailable" };
      }
    },
  };
}
