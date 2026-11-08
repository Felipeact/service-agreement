import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationCallbacks, CallbackFailure, ClaimResult, NotificationMessage } from "@/application/ports";
import { isContractRefusal } from "@/domain/notifications";
import type { Database, Json } from "./database.types";

type Client = SupabaseClient<Database>;

/** The SQLSTATEs `automation_claim` and `automation_complete` raise on purpose (outbox-dispatch door 3). */
const FAILURES: Record<string, CallbackFailure> = { "42501": "unauthorized", "22023": "malformed", P0002: "not_found" };

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

function tenant(value: unknown) {
  const t = isRecord(value) ? value : {};
  return { legalName: text(t.legalName) ?? "", phone: text(t.phone), accent: text(t.accent) };
}

/** One message of the claim's `messages` (plan Landing 11) as the app's type. */
function toMessage(raw: Raw): NotificationMessage {
  const base = {
    notificationId: raw.notificationId as string,
    to: Array.isArray(raw.to) ? raw.to.filter((address): address is string => typeof address === "string") : [],
    tenant: tenant(raw.tenant),
  };
  const agreement = isRecord(raw.agreement) ? { id: raw.agreement.id as string, number: raw.agreement.number as string } : { id: "", number: "" };
  switch (raw.kind) {
    case "customer_link":
    case "customer_reminder":
      return {
        ...base,
        kind: raw.kind,
        replyTo: text(raw.replyTo),
        agreement,
        site: { name: isRecord(raw.site) ? (text(raw.site.name) ?? "") : "" },
        annualCents: typeof raw.annualCents === "number" ? raw.annualCents : 0,
        tokenSealed: text(raw.tokenSealed) ?? "",
        reminder: raw.reminder === "day3" || raw.reminder === "day7" ? raw.reminder : null,
      };
    case "staff_decision":
      return {
        ...base,
        kind: "staff_decision",
        agreement,
        customer: { name: isRecord(raw.customer) ? (text(raw.customer.name) ?? "") : "" },
        decision: raw.decision === "refused" ? "refused" : "changes_requested",
        reason: text(raw.reason),
      };
    case "staff_stale":
      return {
        ...base,
        kind: "staff_stale",
        orgId: raw.orgId as string,
        agreements: (Array.isArray(raw.agreements) ? raw.agreements.filter(isRecord) : []).map((item) => ({
          id: item.id as string,
          number: text(item.number) ?? "",
          customerName: text(item.customerName) ?? "",
          sentAt: new Date(item.sentAt as string),
        })),
      };
    case "customer_renewal":
    case "staff_renewal": {
      // A renewal email without its agreement or key cannot be sent or recorded, so the whole claim is refused.
      const key = text(raw.idempotencyKey);
      if (!isRecord(raw.agreement) || !key) throw new Error(`automation_claim returned a malformed ${raw.kind} message`);
      const renews = isRecord(raw.renews) ? raw.renews : {};
      const site = { name: isRecord(raw.site) ? (text(raw.site.name) ?? "") : "" };
      if (raw.kind === "customer_renewal") {
        const term = isRecord(raw.term) ? raw.term : {};
        return {
          ...base,
          kind: "customer_renewal",
          idempotencyKey: key,
          agreement,
          renews: { number: text(renews.number) ?? "" },
          site,
          oldAnnualCents: typeof raw.oldAnnualCents === "number" ? raw.oldAnnualCents : 0,
          annualCents: typeof raw.annualCents === "number" ? raw.annualCents : 0,
          appliedPct: typeof raw.appliedPct === "number" ? raw.appliedPct : 0,
          term: { start: text(term.start) ?? "", end: text(term.end) ?? "", months: typeof term.months === "number" ? term.months : 0 },
        };
      }
      return {
        ...base,
        kind: "staff_renewal",
        idempotencyKey: key,
        agreement,
        renews: { number: text(renews.number) ?? "", termEnd: text(renews.termEnd) ?? "" },
        site,
        customer: { name: isRecord(raw.customer) ? (text(raw.customer.name) ?? "") : "" },
        reason: raw.reason === "at_threshold" || raw.reason === "cpi_stale" ? raw.reason : "cpi_unset",
        cpiPct: typeof raw.cpiPct === "number" ? raw.cpiPct : null,
      };
    }
    case "staff_expired": {
      // As a renewal email: without its agreement, key or date it cannot be sent or recorded.
      const key = text(raw.idempotencyKey);
      const validUntil = text(raw.validUntil);
      if (!isRecord(raw.agreement) || !key || !validUntil) throw new Error("automation_claim returned a malformed staff_expired message");
      return {
        ...base,
        kind: "staff_expired",
        idempotencyKey: key,
        agreement,
        customer: { name: isRecord(raw.customer) ? (text(raw.customer.name) ?? "") : "" },
        site: { name: isRecord(raw.site) ? (text(raw.site.name) ?? "") : "" },
        validUntil,
      };
    }
    case "staff_contract_ready": {
      const contract = isRecord(raw.contract) && text(raw.contract.id) ? { id: raw.contract.id as string } : null;
      const refusal = isContractRefusal(raw.refusal) ? raw.refusal : null;
      // Neither a contract nor a reason: the email would say nothing, so the whole claim is refused.
      if (!isRecord(raw.agreement) || (!contract && !refusal)) throw new Error("automation_claim returned a malformed staff_contract_ready message");
      return { ...base, kind: "staff_contract_ready", agreement, site: { name: isRecord(raw.site) ? (text(raw.site.name) ?? "") : "" }, contract, refusal };
    }
    case "customer_signing_link": {
      const linkSealed = text(raw.linkSealed);
      if (!isRecord(raw.agreement) || !linkSealed) throw new Error("automation_claim returned a malformed customer_signing_link message");
      return {
        ...base,
        kind: "customer_signing_link",
        agreement,
        site: { name: isRecord(raw.site) ? (text(raw.site.name) ?? "") : "" },
        signerName: text(raw.signerName) ?? "",
        linkSealed,
      };
    }
    case "contract_signed_copy": {
      const key = text(raw.idempotencyKey);
      const documents = (Array.isArray(raw.documents) ? raw.documents.filter(isRecord) : []).flatMap((item) =>
        (item.kind === "signed" || item.kind === "audit_log") && text(item.contentBase64) ? [{ kind: item.kind as "signed" | "audit_log", contentBase64: item.contentBase64 as string }] : [],
      );
      if (!isRecord(raw.agreement) || !key || documents.length !== 2) throw new Error("automation_claim returned a malformed contract_signed_copy message");
      return {
        ...base,
        kind: "contract_signed_copy",
        idempotencyKey: key,
        agreement,
        site: { name: isRecord(raw.site) ? (text(raw.site.name) ?? "") : "" },
        signerName: text(raw.signerName) ?? "",
        documents,
      };
    }
    case "staff_contract_signed": {
      const key = text(raw.idempotencyKey);
      if (!isRecord(raw.agreement) || !isRecord(raw.contract) || !text(raw.contract.id) || !key) {
        throw new Error("automation_claim returned a malformed staff_contract_signed message");
      }
      return {
        ...base,
        kind: "staff_contract_signed",
        idempotencyKey: key,
        agreement,
        contract: { id: raw.contract.id as string },
        site: { name: isRecord(raw.site) ? (text(raw.site.name) ?? "") : "" },
        customer: { name: isRecord(raw.customer) ? (text(raw.customer.name) ?? "") : "" },
      };
    }
    default:
      throw new Error(`automation_claim returned an unknown kind ${String(raw.kind)}`);
  }
}

function toClaim(json: unknown): ClaimResult {
  const result = isRecord(json) ? json : {};
  switch (result.decision) {
    case "send":
      return { ok: true, decision: "send", messages: (Array.isArray(result.messages) ? result.messages.filter(isRecord) : []).map(toMessage) };
    case "skip":
      return { ok: true, decision: "skip", reason: text(result.reason) ?? "none" };
    case "duplicate":
    case "in_flight":
      return { ok: true, decision: result.decision };
    default:
      throw new Error(`automation_claim returned an unknown decision ${String(result.decision)}`);
  }
}

/**
 * The database verifies n8n's signed callbacks itself; this client is `anon` with the publishable key, never a
 * service-role key (outbox-dispatch door 3, AD-068). Anything but the three refusals is thrown.
 */
export function supabaseAutomationCallbacks(client: Client): AutomationCallbacks {
  return {
    async claim({ body, timestamp, signature }) {
      const { data, error } = await client.rpc("automation_claim", { p_body: body, p_timestamp: timestamp, p_signature: signature });
      if (error) {
        const code = FAILURES[error.code];
        if (!code) throw new Error(`automation_claim failed: ${error.code} ${error.message}`);
        return { ok: false, code };
      }
      return toClaim(data);
    },
    async complete({ body, timestamp, signature }, results) {
      const { error } = await client.rpc("automation_complete", {
        p_body: body,
        p_timestamp: timestamp,
        p_signature: signature,
        p_results: results as unknown as Json,
      });
      if (error) throw new Error(`automation_complete failed: ${error.code} ${error.message}`);
    },
  };
}
