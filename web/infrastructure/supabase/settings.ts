import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgSettingsStore } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

export function supabaseOrgSettingsStore(client: Client): OrgSettingsStore {
  return {
    async get(orgId) {
      const { data, error } = await client.from("org_settings").select("*").eq("org_id", orgId).maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (!data) return null;
      return {
        legalName: data.legal_name,
        address: data.address,
        phone: data.phone,
        accentColor: data.accent_color,
        repairDiscountPct: Number(data.repair_discount_pct),
        cpiCapPct: Number(data.cpi_cap_pct),
        cancellationNoticeDays: data.cancellation_notice_days,
        paymentDays: data.payment_days,
        governingProvince: data.governing_province,
        taxNote: data.tax_note,
      };
    },

    async save(orgId, value, at) {
      try {
        const { data, error } = await client
          .from("org_settings")
          .update({
            legal_name: value.legalName,
            address: value.address,
            phone: value.phone,
            accent_color: value.accentColor,
            repair_discount_pct: value.repairDiscountPct,
            cpi_cap_pct: value.cpiCapPct,
            cancellation_notice_days: value.cancellationNoticeDays,
            payment_days: value.paymentDays,
            governing_province: value.governingProvince,
            tax_note: value.taxNote,
            updated_at: at.toISOString(),
          })
          .eq("org_id", orgId)
          .select("org_id");
        if (error) {
          console.error(`Saving company settings failed: ${error.code} ${error.message}`);
          return { ok: false, code: "unavailable" };
        }
        // RLS hides rows the member cannot update, so an empty result means refused.
        return data.length === 0 ? { ok: false, code: "forbidden" } : { ok: true };
      } catch (cause) {
        console.error(`Saving company settings failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        return { ok: false, code: "unavailable" };
      }
    },
  };
}
