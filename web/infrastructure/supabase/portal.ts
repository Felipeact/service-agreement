import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { parseTerms, type AgreementStatus } from "@/domain/agreement";
import type {
  AgreementSender,
  PortalDecider,
  PortalLinkStore,
  PortalReader,
  PortalView,
  PortalViewRecorder,
  PortalWriteFailure,
} from "@/application/ports";
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
    async send(agreementId, tokenHash, event, tokenSealed) {
      const args = {
        p_agreement_id: agreementId,
        p_token_hash: tokenHash,
        p_event_type: event.type,
        p_payload: { from: event.from, to: event.to, ...event.data },
      };
      // PostgREST picks the overload by the names sent: with the sealed token, the 5-argument one (outbox-dispatch Landing 10).
      const { error } = await client.rpc("send_agreement", tokenSealed === undefined ? args : { ...args, p_token_sealed: tokenSealed });
      if (!error) return { ok: true };
      const code = FAILURES[error.code];
      if (!code) throw unexpected(error);
      return { ok: false, code };
    },
  };
}

export function supabasePortalLinkStore(client: Client): PortalLinkStore {
  return {
    async reissue(agreementId, tokenHash, tokenSealed) {
      const args = { p_agreement_id: agreementId, p_token_hash: tokenHash };
      const { error } = await client.rpc("reissue_portal_link", tokenSealed === undefined ? args : { ...args, p_token_sealed: tokenSealed });
      if (!error) return { ok: true };
      const code = FAILURES[error.code];
      // 23514 is the send's "no lines"; a reissue has no such refusal, so it is unexpected here.
      if (!code || code === "no_lines") throw unexpected(error);
      return { ok: false, code };
    },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const orNull = (value: unknown): Date | null => (typeof value === "string" ? new Date(value) : null);

/** `portal_view`'s document (customer-portal door 2, 8) as the app's `PortalView`; `null` for an unknown link. */
function toView(json: unknown): PortalView | null {
  if (!isRecord(json) || !isRecord(json.link) || !isRecord(json.agreement)) return null;
  const { link, agreement, tenant, customer, site, decision } = json as Record<string, Record<string, unknown> | null>;
  if (!link || !agreement || !customer || !site) return null;
  return {
    link: {
      versionNo: link.versionNo as number,
      current: link.current === true,
      revoked: link.revoked === true,
      revokedAt: orNull(link.revokedAt),
      firstViewedAt: orNull(link.firstViewedAt),
    },
    agreement: { number: agreement.number as string, status: agreement.status as AgreementStatus },
    tenant: tenant
      ? { name: tenant.name as string, address: (tenant.address as string | null) ?? null, phone: (tenant.phone as string | null) ?? null, accent: (tenant.accent as string | null) ?? null }
      : null,
    customer: { name: customer.name as string },
    site: { name: site.name as string },
    lines: (json.lines as PortalView["lines"]) ?? [],
    annualCents: json.annualCents as number,
    scope: json.scope ?? null,
    terms: parseTerms({ terms: json.terms }),
    decision: decision
      ? {
          status: decision.status as "accepted" | "refused" | "changes_requested",
          decidedAt: new Date(decision.decidedAt as string),
          reason: (decision.reason as string | null) ?? null,
        }
      : null,
  };
}

/** Reads through the request's own client: `anon` for a customer, `authenticated` for a member, the same answer (AC 36). */
export function supabasePortalReader(client: Client): PortalReader {
  return {
    async view(tokenHash) {
      const { data, error } = await client.rpc("portal_view", { p_token_hash: tokenHash });
      if (error) throw unexpected(error);
      return toView(data);
    },
  };
}

export function supabasePortalDecider(client: Client): PortalDecider {
  return {
    async decide(tokenHash, event) {
      const { error } = await client.rpc("portal_decide", {
        p_token_hash: tokenHash,
        p_to_status: event.to,
        p_event_type: event.type,
        p_payload: { ...event.data },
      });
      if (!error) return { ok: true };
      // 40001: not current, not sent or revoked. P0002: no such link.
      if (error.code === "40001" || error.code === "P0002") return { ok: false, code: "not_open" };
      throw unexpected(error);
    },
  };
}

export function supabasePortalViewRecorder(client: Client): PortalViewRecorder {
  return {
    async record(tokenHash) {
      const { error } = await client.rpc("portal_record_view", { p_token_hash: tokenHash });
      if (error) throw unexpected(error);
    },
  };
}
