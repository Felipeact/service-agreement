import type { SupabaseClient } from "@supabase/supabase-js";
import { parseContractParties, type ContractStatus } from "@/domain/contract";
import { isUuid } from "@/domain/imports";
import type { ContractReader, ContractStore, GenerateContractFailure } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** The hints `create_contract` raises with `55000` (contract-generation door 2). */
const REFUSALS: readonly GenerateContractFailure[] = ["not_accepted", "auto_renewal", "site_inactive", "no_term_start", "no_signer"];

function unavailable(cause: unknown): { ok: false; code: "unavailable" } {
  console.error(`Generating a contract failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  return { ok: false, code: "unavailable" };
}

export function supabaseContractStore(client: Client): ContractStore {
  return {
    async create(agreementId) {
      try {
        const { data, error } = await client.rpc("create_contract", { p_agreement_id: agreementId });
        if (!error) return data ? { ok: true, id: data } : unavailable("create_contract returned no id");
        if (error.code === "42501") return { ok: false, code: "forbidden" };
        if (error.code === "P0002") return { ok: false, code: "not_found" };
        const refusal = error.code === "55000" ? REFUSALS.find((hint) => hint === error.hint) : undefined;
        return refusal ? { ok: false, code: refusal } : unavailable(`${error.code} ${error.message}`);
      } catch (cause) {
        return unavailable(cause);
      }
    },
  };
}

type ContractRow = {
  id: string;
  status: string;
  created_at: string;
  parties: unknown;
  agreement_versions: { version_no: number; agreement_id: string; agreements: { number: string | null } };
};

export function supabaseContractReader(client: Client): ContractReader {
  return {
    async get(id) {
      if (!isUuid(id)) return null;
      const { data, error } = await client
        .from("contracts")
        .select("id, status, created_at, parties, agreement_versions(version_no, agreement_id, agreements(number))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (!data) return null;
      const row = data as unknown as ContractRow;
      return {
        id: row.id,
        status: row.status as ContractStatus,
        agreementId: row.agreement_versions.agreement_id,
        versionNo: row.agreement_versions.version_no,
        number: row.agreement_versions.agreements.number ?? "",
        createdAt: new Date(row.created_at),
        parties: parseContractParties(row.parties),
      };
    },
  };
}
