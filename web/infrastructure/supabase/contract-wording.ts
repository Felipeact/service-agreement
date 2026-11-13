import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { validateContractWording, type ContractWordingBody } from "@/domain/contract";
import type { ContractWordingFailure, ContractWordingReader, ContractWordingStore } from "@/application/ports";
import type { Database, Json } from "./database.types";

type Client = SupabaseClient<Database>;

/** SQLSTATEs `save_contract_template` raises on purpose (block-editor door 2). */
const FAILURES: Record<string, ContractWordingFailure> = { "42501": "forbidden", "22023": "invalid" };

function failure(error: Pick<PostgrestError, "code" | "message">): { ok: false; code: ContractWordingFailure } {
  const code = FAILURES[error.code];
  if (code) return { ok: false, code };
  console.error(`Saving the contract wording failed: ${error.code} ${error.message}`);
  return { ok: false, code: "unavailable" };
}

function unavailable(what: string, cause: unknown): { ok: false; code: "unavailable" } {
  console.error(`${what} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  return { ok: false, code: "unavailable" };
}

/**
 * The wording the contract editor opens on: the org's own contract template's latest version, or the system wording while the org
 * has none. RLS shows the org's own and the system template, so one query reads both; wording this product cannot read is
 * unavailable, never other wording.
 */
export function supabaseContractWordingReader(client: Client): ContractWordingReader {
  return {
    async read() {
      try {
        const { data, error } = await client
          .from("document_templates")
          .select("id, org_id, document_template_versions(version_no, body)")
          .eq("kind", "contract")
          .order("version_no", { referencedTable: "document_template_versions", ascending: false })
          .limit(1, { referencedTable: "document_template_versions" });
        if (error) return unavailable("Reading the contract wording", `${error.code} ${error.message}`);

        const rows = data.filter((row) => row.document_template_versions[0]);
        const row = rows.find((candidate) => candidate.org_id !== null) ?? rows.find((candidate) => candidate.org_id === null);
        if (!row) return unavailable("Reading the contract wording", "no contract template is readable");
        const checked = validateContractWording(row.document_template_versions[0].body);
        if (!checked.ok) return unavailable("Reading the contract wording", `template ${row.id} has no readable wording: ${checked.reason}`);
        return { ok: true, body: checked.body, own: row.org_id !== null };
      } catch (cause) {
        return unavailable("Reading the contract wording", cause);
      }
    },
  };
}

/** Writes through `save_contract_template` as the member: the database decides who may and what the wording may hold. */
export function supabaseContractWordingStore(client: Client): ContractWordingStore {
  return {
    async save(body: ContractWordingBody) {
      try {
        const { data, error } = await client.rpc("save_contract_template", { p_body: body as unknown as Json });
        if (error) return failure(error);
        const saved = data?.[0];
        if (!saved) return unavailable("Saving the contract wording", "no row came back");
        return { ok: true, templateId: saved.template_id, versionNo: saved.version_no };
      } catch (cause) {
        return unavailable("Saving the contract wording", cause);
      }
    },
  };
}
