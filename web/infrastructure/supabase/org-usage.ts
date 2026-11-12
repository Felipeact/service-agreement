import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgUsageReader } from "@/application/ports";
import type { OrgUsage, UsageFigure } from "@/domain/billing/plan-limits";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

function figure(value: unknown): UsageFigure | null {
  if (typeof value !== "object" || value === null) return null;
  const { used, limit } = value as Record<string, unknown>;
  if (typeof used !== "number") return null;
  return { used, limit: typeof limit === "number" ? limit : null };
}

/**
 * Reads `org_usage` for the signed-in owner or admin (plan-limits door 3). Anything that is not a well-formed answer is `null`,
 * so the billing page can say "Usage unavailable" and still show the rest. A failure is logged by its code only.
 */
export function supabaseOrgUsage(client: Client): OrgUsageReader {
  return {
    async read(): Promise<OrgUsage | null> {
      try {
        const { data, error } = await client.rpc("org_usage");
        if (error) {
          console.error(`Reading the usage failed: ${error.code}`);
          return null;
        }
        const row = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
        const liveAgreements = figure(row?.live_agreements);
        const aiImports = figure(row?.ai_imports);
        if (!row || !liveAgreements || !aiImports || typeof row.resets_on !== "string") {
          console.error("Reading the usage failed: the answer was not a row");
          return null;
        }
        return { plan: typeof row.plan === "string" ? row.plan : null, liveAgreements, aiImports, resetsOn: row.resets_on };
      } catch (cause) {
        console.error(`Reading the usage failed: ${cause instanceof Error ? cause.name : "a non-error"}`);
        return null;
      }
    },
  };
}
