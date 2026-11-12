import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportAllowance } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** `import_allowance` answers a jsonb object; anything else is not an answer. */
function asRow(data: unknown): { plan: string | null; used: number; limit: number | null; allowed: boolean; resets_on: string } | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.used !== "number" || typeof row.allowed !== "boolean" || typeof row.resets_on !== "string") return null;
  return { plan: typeof row.plan === "string" ? row.plan : null, used: row.used, limit: typeof row.limit === "number" ? row.limit : null, allowed: row.allowed, resets_on: row.resets_on };
}

/**
 * Asks `import_allowance` whether the org of a job may start another AI import this month (plan-limits door 2). The function
 * checks the role itself: `42501` is a viewer, `P0002` a job that is not the caller's. A failure is logged by its code only.
 */
export function supabaseImportAllowance(client: Client): ImportAllowance {
  return {
    async check(jobId) {
      try {
        const { data, error } = await client.rpc("import_allowance", { p_job_id: jobId });
        if (error) {
          console.error(`Reading the import allowance failed: ${error.code}`);
          if (error.code === "42501") return { ok: false, code: "forbidden" };
          if (error.code === "P0002") return { ok: false, code: "not_found" };
          return { ok: false, code: "unavailable" };
        }
        const row = asRow(data);
        if (!row) {
          console.error("Reading the import allowance failed: the answer was not a row");
          return { ok: false, code: "unavailable" };
        }
        if (row.allowed || row.plan === null || row.limit === null) return { ok: true, allowed: true };
        return { ok: true, allowed: false, plan: row.plan, limit: row.limit, used: row.used, resetsOn: row.resets_on };
      } catch (cause) {
        console.error(`Reading the import allowance failed: ${cause instanceof Error ? cause.name : "a non-error"}`);
        return { ok: false, code: "unavailable" };
      }
    },
  };
}
