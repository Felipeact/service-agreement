import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTRACT_STATUSES, SIGNATURE_REQUEST_STATUSES, type ContractStatus, type SignatureRequestStatus } from "@/domain/contract";
import type {
  BeginSignatureFailure,
  SignatureStore,
  SigningReader,
  SigningSecretFailure,
  SigningSecretResult,
  SigningSecrets,
  SigningView,
} from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** The hints `begin_signature_request` raises with `55000` (signature-provider door 3). */
const BEGIN_REFUSALS: readonly BeginSignatureFailure[] = ["not_pending", "parties_missing", "already_open"];
/** The hints the two secret readers raise with `55000`. */
const SECRET_REFUSALS: readonly SigningSecretFailure[] = ["not_client_signed", "no_request"];

function unavailable(what: string, cause: unknown): { ok: false; code: "unavailable" } {
  console.error(`${what} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  return { ok: false, code: "unavailable" };
}

type RpcError = { code: string; message: string; hint?: string | null };

/** `42501` is forbidden and `P0002` not found everywhere; the rest is the function's own hint, or unavailable. */
function beginFailure(error: RpcError): BeginSignatureFailure {
  if (error.code === "42501") return "forbidden";
  if (error.code === "P0002") return "not_found";
  if (error.code === "23514" && error.hint === "invalid_name") return "invalid_name";
  const refusal = error.code === "55000" ? BEGIN_REFUSALS.find((hint) => hint === error.hint) : undefined;
  if (refusal) return refusal;
  console.error(`Beginning a signature request failed: ${error.code} ${error.message}`);
  return "unavailable";
}

function secretFailure(error: RpcError): SigningSecretFailure {
  if (error.code === "42501") return "forbidden";
  if (error.code === "P0002") return "not_found";
  const refusal = error.code === "55000" ? SECRET_REFUSALS.find((hint) => hint === error.hint) : undefined;
  if (refusal) return refusal;
  console.error(`Reading a signing secret failed: ${error.code} ${error.message}`);
  return "unavailable";
}

export function supabaseSignatureStore(client: Client): SignatureStore {
  return {
    async begin(contractId, contractorName, customerTokenHash) {
      try {
        const { data, error } = await client.rpc("begin_signature_request", {
          p_contract_id: contractId,
          p_contractor_name: contractorName,
          p_customer_token_hash: customerTokenHash,
        });
        if (error) return { ok: false, code: beginFailure(error) };
        return data ? { ok: true, requestId: data } : unavailable("Beginning a signature request", "no id returned");
      } catch (cause) {
        return unavailable("Beginning a signature request", cause);
      }
    },

    async complete(requestId, submissionId, signers, customerLinkSealed, documentSha256) {
      try {
        const { error } = await client.rpc("complete_signature_request", {
          p_request_id: requestId,
          p_submission_id: submissionId,
          p_signers: signers,
          p_customer_link_sealed: customerLinkSealed,
          p_document_sha256: documentSha256,
        });
        if (!error) return { ok: true };
        return unavailable("Completing a signature request", `${error.code} ${error.message}`);
      } catch (cause) {
        return unavailable("Completing a signature request", cause);
      }
    },

    async fail(requestId) {
      try {
        const { error } = await client.rpc("fail_signature_request", { p_request_id: requestId });
        if (error) console.error(`Failing signature request ${requestId} failed: ${error.code} ${error.message}`);
      } catch (cause) {
        console.error(`Failing signature request ${requestId} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    },
  };
}

export function supabaseSigningSecrets(client: Client): SigningSecrets {
  async function read(fn: "customer_signing_link" | "contractor_signing_source", contractId: string): Promise<SigningSecretResult> {
    try {
      const { data, error } = await client.rpc(fn, { p_contract_id: contractId });
      if (error) return { ok: false, code: secretFailure(error) };
      return data ? { ok: true, sealed: data } : unavailable("Reading a signing secret", "no value returned");
    } catch (cause) {
      return unavailable("Reading a signing secret", cause);
    }
  }
  return {
    customerLink: (contractId) => read("customer_signing_link", contractId),
    contractorSource: (contractId) => read("contractor_signing_source", contractId),
  };
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * Reads `public.signature_view` as the signed-out visitor or a member alike (the cookie client, as the portal does). An
 * answer missing a field the page needs is read as no link, so the visitor sees the 404 page and never half a page.
 */
export function supabaseSigningReader(client: Client): SigningReader {
  return {
    async view(tokenHash) {
      const { data, error } = await client.rpc("signature_view", { p_token_hash: tokenHash });
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      const row = data as Record<string, unknown>;
      const contractStatus = CONTRACT_STATUSES.find((status) => status === row.contractStatus) as ContractStatus | undefined;
      const requestStatus = SIGNATURE_REQUEST_STATUSES.find((status) => status === row.requestStatus) as SignatureRequestStatus | undefined;
      const agreement = row.agreement as { number?: unknown } | null;
      const signer = row.signer as { name?: unknown } | null;
      const agreementNumber = text(agreement?.number);
      const signerName = text(signer?.name);
      // `embedSealed` is `null` in JSON for a closed request, but the key is always there: its absence is a malformed answer.
      if (!contractStatus || !requestStatus || agreementNumber === null || signerName === null || !("embedSealed" in row)) return null;
      const tenant = row.tenant as Record<string, unknown> | null;
      const view: SigningView = {
        tenant: tenant && text(tenant.name) !== null ? { name: text(tenant.name)!, address: text(tenant.address), phone: text(tenant.phone), accent: text(tenant.accent), logoPath: text(tenant.logoPath) } : null,
        agreementNumber,
        signerName,
        contractStatus,
        requestStatus,
        embedSealed: text(row.embedSealed),
      };
      return view;
    },
  };
}
