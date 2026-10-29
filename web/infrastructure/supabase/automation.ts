import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationCallbacks, CallbackFailure, ClaimResult, NotificationMessage } from "@/application/ports";
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
