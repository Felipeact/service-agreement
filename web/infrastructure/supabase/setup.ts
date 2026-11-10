import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgSetup, SaveSettingsResult } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** The first-login setup store (first-login-setup door 1): it reads and writes only as the signed-in member, under RLS. */
export function supabaseOrgSetup(client: Client): OrgSetup {
  /** Sets `setup_completed_at` only where it is still null, so a second stamp keeps the first (C2813). */
  async function stamp(orgId: string, at: Date): Promise<SaveSettingsResult> {
    try {
      const { error } = await client
        .from("org_settings")
        .update({ setup_completed_at: at.toISOString() })
        .eq("org_id", orgId)
        .is("setup_completed_at", null);
      if (error) {
        console.error(`Finishing setup failed: ${error.code} ${error.message}`);
        return { ok: false, code: "unavailable" };
      }
      return { ok: true };
    } catch (cause) {
      console.error(`Finishing setup failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      return { ok: false, code: "unavailable" };
    }
  }

  return {
    async isPending(orgId) {
      const { data, error } = await client.from("org_settings").select("setup_completed_at").eq("org_id", orgId).maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      return data !== null && data.setup_completed_at === null;
    },

    async catalog() {
      const { data, error } = await client.from("asset_types").select("pack, name").order("name");
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      return (data ?? []).map((row) => ({ pack: row.pack, name: row.name }));
    },

    async saveProfile(orgId, value, at) {
      try {
        const { data, error } = await client
          .from("org_settings")
          .update({
            legal_name: value.legalName,
            address: value.address,
            phone: value.phone,
            accent_color: value.accentColor,
            governing_province: value.governingProvince,
            item_singular: value.itemSingular,
            item_plural: value.itemPlural,
            updated_at: at.toISOString(),
          })
          .eq("org_id", orgId)
          .select("org_id");
        if (error) {
          console.error(`Saving the setup profile failed: ${error.code} ${error.message}`);
          return { ok: false, code: "unavailable" };
        }
        // RLS hides rows the member cannot update, so an empty result means refused, and nothing is stamped.
        if (data.length === 0) return { ok: false, code: "forbidden" };
      } catch (cause) {
        console.error(`Saving the setup profile failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        return { ok: false, code: "unavailable" };
      }
      return stamp(orgId, at);
    },

    skip: stamp,
  };
}
