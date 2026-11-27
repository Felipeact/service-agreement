import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * The plan key of the signed-in member's company (`starter`, `team`, `business`), or `null` when it has no billing row or the
 * read failed, which the plan check treats as no access. Reads `org_plan`, which any member may call; the function is newer than
 * the generated types.
 */
export async function readMemberPlan(client: SupabaseClient<Database>): Promise<string | null> {
  const { data, error } = await (client as unknown as SupabaseClient).rpc("org_plan");
  if (error) {
    console.error(`Reading the plan failed: ${error.code}`);
    return null;
  }
  return typeof data === "string" ? data : null;
}
