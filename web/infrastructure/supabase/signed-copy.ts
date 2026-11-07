import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/domain/imports";
import type { SignedCopyReader } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** PostgREST sends a `bytea` as `\x` and hex digits. */
function fromHex(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex"));
}

/** Reads a stored signed file as the signed-in member; RLS limits it to the member's org (signature-webhook door 6). */
export function supabaseSignedCopyReader(client: Client): SignedCopyReader {
  return {
    async get(contractId, kind) {
      if (!isUuid(contractId)) return null;
      const { data, error } = await client
        .from("contract_signed_documents")
        .select("content, sha256, contract_signature_requests!inner(contract_id)")
        .eq("kind", kind)
        .eq("contract_signature_requests.contract_id", contractId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (!data) return null;
      return { bytes: fromHex(data.content), sha256: data.sha256 };
    },
  };
}
