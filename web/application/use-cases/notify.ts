import { customerEmail, isReservedAddress, staffDecisionEmail, staleEmail, type EmailContent } from "@/domain/notifications";
import { portalLinkUrl } from "@/domain/portal";
import type {
  AutomationCallbacks,
  CallbackFailure,
  EmailMessage,
  EmailSender,
  NotificationMessage,
  NotificationOutcome,
  PortalTokens,
  SignedCallback,
} from "@/application/ports";

/** What the callback route answers: `200` with the outcome, or the failure it maps to a status (outbox-dispatch Surface). */
export type NotifyResult =
  | { ok: true; outcome: "sent" | "skipped" | "duplicate"; reason?: string }
  | { ok: false; code: CallbackFailure | "in_flight" | "unavailable" };

function content(message: NotificationMessage, appBaseUrl: string, tokens: Pick<PortalTokens, "unseal">): EmailContent {
  switch (message.kind) {
    case "customer_link":
    case "customer_reminder":
      return customerEmail({
        tenant: message.tenant,
        agreementNumber: message.agreement.number,
        siteName: message.site.name,
        annualCents: message.annualCents,
        reviewUrl: portalLinkUrl(appBaseUrl, tokens.unseal(message.tokenSealed)),
        reminder: message.kind === "customer_reminder" ? message.reminder : null,
      });
    case "staff_decision":
      return staffDecisionEmail({
        appBaseUrl,
        agreement: message.agreement,
        customerName: message.customer.name,
        decision: message.decision,
        reason: message.reason,
      });
    case "staff_stale":
      return staleEmail({ appBaseUrl, agreements: message.agreements });
  }
}

/** The provider key of one message: the notification's own idempotency key (door 4), per org for W5. */
function providerKey(key: string, message: NotificationMessage): string {
  return message.kind === "staff_stale" ? `${key}:${message.orgId}` : key;
}

async function deliver(
  message: NotificationMessage,
  key: string,
  sender: EmailSender,
  appBaseUrl: string,
  tokens: Pick<PortalTokens, "unseal">,
): Promise<NotificationOutcome> {
  const to = message.to.filter((address) => !isReservedAddress(address));
  if (to.length === 0) return { id: message.notificationId, outcome: "skipped", reason: "reserved_domain" };

  let email: EmailMessage;
  try {
    email = {
      to,
      fromName: message.tenant.legalName,
      ...("replyTo" in message && message.replyTo ? { replyTo: message.replyTo } : {}),
      ...content(message, appBaseUrl, tokens),
      idempotencyKey: providerKey(key, message),
    };
  } catch (cause) {
    // A sealed token this key cannot open: recorded as failed, so the key can be claimed again once the key is fixed.
    console.error(`Notification ${message.notificationId} could not be built`, cause);
    return { id: message.notificationId, outcome: "failed", error: "could not build the email" };
  }

  const sent = await sender.send(email);
  if (sent.ok) return { id: message.notificationId, outcome: "sent", providerMessageId: sent.providerMessageId };
  if (sent.code === "reserved_domain") return { id: message.notificationId, outcome: "skipped", reason: "reserved_domain" };
  return { id: message.notificationId, outcome: "failed", error: sent.code };
}

/**
 * One signed callback from n8n: the database verifies and claims it, the app builds and sends each email, and the
 * database records the outcome. A failed send answers `unavailable`, so n8n retries and the key is claimed again (AC 16).
 */
export function makeNotify(callbacks: AutomationCallbacks, sender: EmailSender, tokens: Pick<PortalTokens, "unseal">, appBaseUrl: string) {
  return async function notify(callback: SignedCallback): Promise<NotifyResult> {
    const claim = await callbacks.claim(callback);
    if (!claim.ok) return claim;
    if (claim.decision === "duplicate") return { ok: true, outcome: "duplicate" };
    if (claim.decision === "in_flight") return { ok: false, code: "in_flight" };
    if (claim.decision === "skip") return { ok: true, outcome: "skipped", reason: claim.reason };

    const key = (JSON.parse(callback.body) as { idempotencyKey: string }).idempotencyKey;
    const results: NotificationOutcome[] = [];
    for (const message of claim.messages) {
      results.push(await deliver(message, key, sender, appBaseUrl, tokens));
    }
    await callbacks.complete(callback, results);

    if (results.some((result) => result.outcome === "failed")) return { ok: false, code: "unavailable" };
    if (results.some((result) => result.outcome === "sent")) return { ok: true, outcome: "sent" };
    return { ok: true, outcome: "skipped", reason: "reserved_domain" };
  };
}
