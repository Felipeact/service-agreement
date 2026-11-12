import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogWriter } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/**
 * Writes an accepted catalog draft through `add_catalog_draft` (other-trade-draft door 2). The function checks the role and that the
 * catalog is still empty itself: `42501` is not an owner or admin, `55000` is a catalog that gained a type, `23514` is a draft that
 * breaks a bound. A failure is logged by its code only, never the draft.
 */
export function supabaseCatalogWriter(client: Client): CatalogWriter {
  return {
    async add(orgId, trade, types) {
      try {
        const { data, error } = await client.rpc("add_catalog_draft", { p_org_id: orgId, p_trade: trade, p_types: types });
        if (!error) return { ok: true, added: Number(data) };
        console.error(`Adding the drafted catalog failed: ${error.code}`);
        if (error.code === "42501") return { ok: false, code: "forbidden" };
        if (error.code === "55000") return { ok: false, code: "not_empty" };
        if (error.code === "23514") return { ok: false, code: "invalid" };
        return { ok: false, code: "unavailable" };
      } catch (cause) {
        console.error(`Adding the drafted catalog failed: ${cause instanceof Error ? cause.name : "a non-error"}`);
        return { ok: false, code: "unavailable" };
      }
    },
  };
}
