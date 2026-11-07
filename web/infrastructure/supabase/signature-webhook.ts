import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignatureWebhooks, WebhookAnswer } from "@/application/ports";
import { SIGNED_DOCUMENT_KINDS, type SignedDocumentKind } from "@/domain/contract";
import type { Database, Json } from "./database.types";

type Client = SupabaseClient<Database>;

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const REASONS = ["event_not_handled", "unknown_submission", "signer_mismatch", "request_closed"] as const;

function toAnswer(json: unknown): WebhookAnswer {
  const answer = isRecord(json) ? json : {};
  switch (answer.outcome) {
    case "applied":
    case "duplicate":
      return { outcome: answer.outcome };
    case "ignored": {
      const reason = REASONS.find((candidate) => candidate === answer.reason);
      if (reason) return { outcome: "ignored", reason };
      break;
    }
    case "documents_needed": {
      const documents = (Array.isArray(answer.documents) ? answer.documents : []).filter(isRecord).flatMap((item) => {
        const kind = SIGNED_DOCUMENT_KINDS.find((candidate): candidate is SignedDocumentKind => candidate === item.kind);
        return kind && typeof item.url === "string" ? [{ kind, url: item.url }] : [];
      });
      if (documents.length === SIGNED_DOCUMENT_KINDS.length) return { outcome: "documents_needed", documents };
      break;
    }
  }
  throw new Error(`signature_webhook returned an unknown answer ${JSON.stringify(answer.outcome)}`);
}

/**
 * The database verifies DocuSeal's signature itself; this client is `anon` with the publishable key, never a service-role
 * key (signature-webhook door 1, AD-068). Only the two refusals are values; anything else is thrown for the caller to log.
 */
export function supabaseSignatureWebhooks(client: Client): SignatureWebhooks {
  return {
    async receive({ body, signature, documents }) {
      const { data, error } = await client.rpc("signature_webhook", {
        p_body: body,
        p_signature: signature,
        p_documents: (documents ?? null) as unknown as Json,
      });
      if (error) {
        if (error.code === "42501") return { ok: false, code: "unauthorized" };
        if (error.code === "22023") return { ok: false, code: "malformed" };
        // The code only: a database message can quote a piece of the delivery.
        throw new Error(`signature_webhook failed: ${error.code}`);
      }
      return { ok: true, answer: toAnswer(data) };
    },
  };
}
