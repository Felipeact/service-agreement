import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgreementScopeStore } from "@/application/ports";
import { parseScopeDraft } from "@/domain/agreement";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** SQLSTATEs of `set_scope_exclusion` (p0-launch-fixes door 2) as the port's codes. */
const CODES: Record<string, "forbidden" | "locked" | "not_found"> = { "42501": "forbidden", P0001: "locked", P0002: "not_found", "23514": "not_found" };

export function supabaseAgreementScopeStore(client: Client): AgreementScopeStore {
  return {
    async uncovered(agreementId) {
      const { data, error } = await client.rpc("agreement_service_scope", { p_agreement_id: agreementId });
      if (error) throw new Error(`agreement_service_scope failed: ${error.code}`);
      return parseScopeDraft(data).uncovered;
    },

    async setExcluded(agreementId, assetId, excluded) {
      try {
        // The current version is the one with the highest number; RLS hides another org's agreement, so nothing found is not_found.
        const found = await client.from("agreement_versions").select("id").eq("agreement_id", agreementId).order("version_no", { ascending: false }).limit(1);
        if (found.error) {
          console.error(`Reading the agreement version failed: ${found.error.code} ${found.error.message}`);
          return { ok: false, code: "unavailable" };
        }
        const versionId = found.data[0]?.id;
        if (!versionId) return { ok: false, code: "not_found" };
        const { error } = await client.rpc("set_scope_exclusion", { p_version_id: versionId, p_asset_id: assetId, p_excluded: excluded });
        if (!error) return { ok: true };
        const code = CODES[error.code];
        if (code) return { ok: false, code };
        console.error(`Changing the scope failed: ${error.code} ${error.message}`);
        return { ok: false, code: "unavailable" };
      } catch (cause) {
        console.error(`Changing the scope failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        return { ok: false, code: "unavailable" };
      }
    },
  };
}
