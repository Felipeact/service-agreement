import type { SupabaseClient } from "@supabase/supabase-js";
import { parseContractParties, SIGNATURE_REQUEST_STATUSES, SIGNED_DOCUMENT_KINDS, type ContractStatus, type SignatureRequestStatus } from "@/domain/contract";
import { isUuid } from "@/domain/imports";
import { isNotEmailedReason } from "@/domain/notifications";
import type { ContractReader, ContractStore, GenerateContractFailure, LinkEmailView, SignedCopyView } from "@/application/ports";
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
  /** Embedded when the reader selects it; absent in a row that did not ask. */
  contract_signature_requests?: RequestRow[];
};

type RequestRow = {
  id: string;
  status: string;
  created_at: string;
  contract_signers?: { role: string; name: string; signed_at: string | null; signed_ip: string | null }[];
  contract_signed_documents?: { kind: string; size_bytes: number; sha256: string }[];
};

function newestOf(rows: RequestRow[]): RequestRow | undefined {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

/** The newest request, or `null` when there is none. */
function newestRequest(rows: RequestRow[]): { requestId: string; status: SignatureRequestStatus } | null {
  const newest = newestOf(rows);
  const status = SIGNATURE_REQUEST_STATUSES.find((candidate) => candidate === newest?.status);
  return newest && status ? { requestId: newest.id, status } : null;
}

/** What the webhook stored, once the newest request is `completed` with both files; `null` before that (signature-webhook S5). */
function signedCopy(rows: RequestRow[]): SignedCopyView | null {
  const newest = newestOf(rows);
  const documents = (newest?.contract_signed_documents ?? []).flatMap((document) => {
    const kind = SIGNED_DOCUMENT_KINDS.find((candidate) => candidate === document.kind);
    return kind ? [{ kind, sizeBytes: document.size_bytes, sha256: document.sha256 }] : [];
  });
  if (newest?.status !== "completed" || documents.length === 0) return null;
  const signers: SignedCopyView["signers"] = (newest.contract_signers ?? []).flatMap((signer) => {
    const role = signer.role === "customer" || signer.role === "contractor" ? signer.role : null;
    return role ? [{ role, name: signer.name, signedAt: signer.signed_at ? new Date(signer.signed_at) : null, ip: signer.signed_ip }] : [];
  });
  return { documents, signers: signers.sort((a, b) => (a.role === b.role ? 0 : a.role === "customer" ? -1 : 1)) };
}

export function supabaseContractReader(client: Client): ContractReader {
  /** The `customer_signing_link` notification of the contract's latest send; `null` when it was never sent (contract-automation AC 13). */
  async function signingLinkEmail(contractId: string): Promise<LinkEmailView | null> {
    const { data: event, error } = await client
      .from("events")
      .select("id")
      .eq("entity_type", "contract")
      .eq("entity_id", contractId)
      .eq("type", "contract.sent_for_signature")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
    if (!event) return null;
    const { data: row, error: rowError } = await client
      .from("notifications")
      .select("status, skip_reason, recipients, sent_at")
      .eq("event_id", event.id)
      .eq("kind", "customer_signing_link")
      .maybeSingle();
    if (rowError) throw new Error(`Supabase error ${rowError.code}: ${rowError.message}`);
    if (row?.status === "sent" && row.sent_at) return { status: "sent", to: row.recipients[0] ?? "", sentAt: new Date(row.sent_at) };
    if (row?.status === "failed") return { status: "not_sent", reason: "failed" };
    if (row?.status === "skipped" && row.skip_reason && isNotEmailedReason(row.skip_reason)) return { status: "not_sent", reason: row.skip_reason };
    return { status: "pending" };
  }

  return {
    async get(id) {
      if (!isUuid(id)) return null;
      const { data, error } = await client
        .from("contracts")
        .select("id, status, created_at, parties, agreement_versions(version_no, agreement_id, agreements(number)), contract_signature_requests(id, status, created_at, contract_signers(role, name, signed_at, signed_ip), contract_signed_documents(kind, size_bytes, sha256))")
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
        signing: row.contract_signature_requests ? newestRequest(row.contract_signature_requests) : undefined,
        signed: row.contract_signature_requests ? signedCopy(row.contract_signature_requests) : undefined,
        signingLinkEmail: row.contract_signature_requests ? await signingLinkEmail(row.id) : undefined,
      };
    },
  };
}
