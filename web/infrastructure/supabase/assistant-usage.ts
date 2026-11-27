import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantUsage } from "@/application/ports";
import type { Database } from "./database.types";

/** The member's own questions in `assistant_questions` (RLS shows each member only their own rows). Time only, never the question. */
export function supabaseAssistantUsage(client: SupabaseClient<Database>): AssistantUsage {
  // The table is newer than the generated types; the untyped view of the client is the narrowest way to reach it.
  const table = () => (client as unknown as SupabaseClient).from("assistant_questions");
  return {
    async countSince(sinceIso) {
      const { count, error } = await table().select("id", { count: "exact", head: true }).gte("asked_at", sinceIso);
      if (error || count === null) throw new Error(`Counting questions failed: ${error?.code ?? "no count"}`);
      return count;
    },
    async monthUsage() {
      const { data, error } = await (client as unknown as SupabaseClient).rpc("assistant_month_usage");
      const row = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
      if (error || !row || typeof row.used !== "number" || typeof row.resets_on !== "string") throw new Error(`Reading the month's questions failed: ${error?.code ?? "no row"}`);
      return { used: row.used, resetsOn: row.resets_on };
    },
    async record(orgId) {
      const { error } = await table().insert({ org_id: orgId });
      if (error) throw new Error(`Recording a question failed: ${error.code}`);
    },
  };
}
