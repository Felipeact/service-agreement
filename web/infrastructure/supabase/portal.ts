import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AgreementSender, PortalLinkStore, PortalWriteFailure } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** SQLSTATEs `send_agreement` and `reissue_portal_link` raise on purpose (customer-portal door 2). */
const FAILURES: Record<string, PortalWriteFailure | "no_lines"> = {
  "40001": "conflict",
  // The one live link per version (door 1): a second writer reached the index first.
  "23505": "conflict",
  P0002: "not_found",
  "42501": "forbidden",
  "23514": "no_lines",
};

function unexpected(error: Pick<PostgrestError, "code" | "message">): Error {
  return new Error(`Supabase error ${error.code}: ${error.message}`);
}

export function supabaseAgreementSender(client: Client): AgreementSender {
  return {
    async send(agreementId, tokenHash, event) {
      const { error } = await client.rpc("send_agreement", {
        p_agreement_id: agreementId,
        p_token_hash: tokenHash,
        p_event_type: event.type,
        p_payload: { from: event.from, to: event.to, ...event.data },
      });
      if (!error) return { ok: true };
      const code = FAILURES[error.code];
      if (!code) throw unexpected(error);
      return { ok: false, code };
    },
  };
}

export function supabasePortalLinkStore(client: Client): PortalLinkStore {
  return {
    async reissue(agreementId, tokenHash) {
      const { error } = await client.rpc("reissue_portal_link", { p_agreement_id: agreementId, p_token_hash: tokenHash });
      if (!error) return { ok: true };
      const code = FAILURES[error.code];
      // 23514 is the send's "no lines"; a reissue has no such refusal, so it is unexpected here.
      if (!code || code === "no_lines") throw unexpected(error);
      return { ok: false, code };
    },
  };
}
