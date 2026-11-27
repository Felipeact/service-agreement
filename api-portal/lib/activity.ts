import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityDoor, ActivityRow } from "./developer";

const WINDOW_DAYS = 30;
const FETCH_ROWS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const DOORS: readonly string[] = ["mcp", "api", "app"];

/**
 * The company's API and MCP calls in the last 30 days, newest first. RLS gives an owner or admin the whole company's rows
 * (`ai_tool_calls`); a read that fails is `null` so a page can say so and still show the rest. In-app calls are left out.
 */
export async function recentActivity(supabase: SupabaseClient, now: Date): Promise<ActivityRow[] | null> {
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString();
  const { data, error } = await supabase.from("ai_tool_calls").select("tool, source, ok, called_at, user_id").gte("called_at", since).order("called_at", { ascending: false }).limit(FETCH_ROWS);
  if (error || !data) return null;
  return data.flatMap((row: Record<string, unknown>) =>
    typeof row.tool === "string" && typeof row.source === "string" && DOORS.includes(row.source) && row.source !== "app" && typeof row.ok === "boolean" && typeof row.called_at === "string" && typeof row.user_id === "string"
      ? [{ at: new Date(row.called_at), tool: row.tool, door: row.source as ActivityDoor, ok: row.ok, userId: row.user_id }]
      : [],
  );
}

/** Member emails by id, for the log. A failed read gives an empty map, and the log says "A former member". */
export async function memberEmails(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("list_members").limit(500);
  if (error || !Array.isArray(data)) return new Map();
  return new Map(data.flatMap((row: Record<string, unknown>) => (typeof row.user_id === "string" && typeof row.email === "string" ? [[row.user_id, row.email] as const] : [])));
}
