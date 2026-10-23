import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AgreementStatus } from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import type { DomainEvent } from "@/domain/transition";
import type {
  AgreementRepository,
  CommitFailure,
  CommitResult,
  ContractRepository,
} from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** SQLSTATEs the `apply_*_transition` functions raise on purpose (door 3). */
const COMMIT_FAILURES: Record<string, CommitFailure> = {
  "40001": "conflict",
  P0002: "not_found",
  "42501": "forbidden",
};

function unexpected(error: Pick<PostgrestError, "code" | "message">): Error {
  return new Error(`Supabase error ${error.code}: ${error.message}`);
}

function commitResult(data: string | null, error: PostgrestError | null): CommitResult {
  if (!error) return { ok: true, eventId: data as string };
  const code = COMMIT_FAILURES[error.code];
  if (!code) throw unexpected(error);
  return { ok: false, code };
}

/** The `events.payload` n8n reads (door 5): from, to and the domain data, camelCase. */
function payload<S extends string>(event: DomainEvent<S>) {
  return { from: event.from, to: event.to, ...event.data };
}

export function supabaseAgreementRepository(client: Client): AgreementRepository {
  return {
    async findById(id) {
      const { data, error } = await client
        .from("agreements")
        .select("status, agreement_versions(version_no)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw unexpected(error);
      if (!data) return null;
      const versionNo = Math.max(0, ...data.agreement_versions.map((version) => version.version_no));
      return { status: data.status as AgreementStatus, versionNo };
    },

    async commitTransition(id, expected, event) {
      const { data, error } = await client.rpc("apply_agreement_transition", {
        p_agreement_id: id,
        p_expected_status: expected,
        p_to_status: event.to,
        p_event_type: event.type,
        p_payload: payload(event),
      });
      return commitResult(data, error);
    },
  };
}

export function supabaseContractRepository(client: Client): ContractRepository {
  return {
    async findById(id) {
      const { data, error } = await client.from("contracts").select("status").eq("id", id).maybeSingle();
      if (error) throw unexpected(error);
      if (!data) return null;
      return { status: data.status as ContractStatus };
    },

    async commitTransition(id, expected, event) {
      const { data, error } = await client.rpc("apply_contract_transition", {
        p_contract_id: id,
        p_expected_status: expected,
        p_to_status: event.to,
        p_event_type: event.type,
        p_payload: payload(event),
      });
      return commitResult(data, error);
    },
  };
}
