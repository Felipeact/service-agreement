import type { SupabaseClient } from "@supabase/supabase-js";
import type { EquipmentTypeCreator } from "@/application/ports";
import type { Database } from "./database.types";

/** Adds an equipment type through `add_equipment_type` as the member (the function checks the role). The function is newer than the generated types. */
export function supabaseEquipmentTypeCreator(client: SupabaseClient<Database>): EquipmentTypeCreator {
  return {
    async create(orgId, name, months) {
      const { data, error } = await (client as unknown as SupabaseClient).rpc("add_equipment_type", { p_org_id: orgId, p_name: name, ...(months && months.length > 0 && { p_months: months }) });
      if (error) {
        console.error(`Adding an equipment type failed: ${error.code}`);
        return { ok: false, code: error.code === "42501" ? "forbidden" : "unavailable" };
      }
      const row = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
      if (!row || typeof row.id !== "string" || typeof row.code !== "string" || typeof row.name !== "string") return { ok: false, code: "unavailable" };
      return { ok: true, type: { id: row.id, code: row.code, name: row.name, created: row.created === true } };
    },
  };
}
