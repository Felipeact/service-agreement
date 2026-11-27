import type { SupabaseClient } from "@supabase/supabase-js";
import { memberEmails, recentActivity } from "./activity";
import { summariseActivity, type ActivityRow, type ActivitySummary } from "./developer";

export const SHOWN_ROWS = 100;

export type LogFilter = { door: "api" | "mcp" | null; failedOnly: boolean };
export type LogLine = ActivityRow & { who: string };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the filter from the address; an unknown value is ignored, so a bad link shows the whole log. */
export function parseFilter(params: Record<string, string | string[] | undefined>): LogFilter {
  const door = one(params.door);
  return { door: door === "api" || door === "mcp" ? door : null, failedOnly: one(params.result) === "failed" };
}

/**
 * The company's API and MCP calls of the last 30 days, newest first, with the member's email. Only the tool, the door, the outcome,
 * the member and the time are kept; never what was asked or answered. A log that cannot be read is `null`.
 */
export async function loadLogs(supabase: SupabaseClient, params: Record<string, string | string[] | undefined>, now: Date): Promise<{ filter: LogFilter; lines: LogLine[] | null; summary: ActivitySummary | null }> {
  const filter = parseFilter(params);
  const [rows, emails] = await Promise.all([recentActivity(supabase, now), memberEmails(supabase)]);
  if (!rows) return { filter, lines: null, summary: null };
  const lines = rows
    .filter((row) => (!filter.door || row.door === filter.door) && (!filter.failedOnly || !row.ok))
    .slice(0, SHOWN_ROWS)
    .map((row) => ({ ...row, who: emails.get(row.userId) ?? "A former member" }));
  return { filter, lines, summary: summariseActivity(rows, now.getTime()) };
}
