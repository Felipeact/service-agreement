import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolAudit } from "@/application/ports";
import type { Database } from "./database.types";

/** Writes one `ai_tool_calls` row as the member (RLS pins the row to them). The table is newer than the generated types. */
export function supabaseToolAudit(client: SupabaseClient<Database>, orgId: string | (() => Promise<string>)): ToolAudit {
  return {
    async record(entry) {
      const { error } = await (client as unknown as SupabaseClient).from("ai_tool_calls").insert({ org_id: typeof orgId === "function" ? await orgId() : orgId, tool: entry.tool, source: entry.source, ok: entry.ok });
      if (error) throw new Error(`Recording a tool call failed: ${error.code}`);
    },
  };
}
