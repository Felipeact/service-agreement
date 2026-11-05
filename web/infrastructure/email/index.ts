import { isReservedAddress } from "@/domain/notifications";
import type { EmailSender } from "@/application/ports";

const RESEND_URL = "https://api.resend.com/emails";

/** `"<name>" <address>`, with `"` and `\` escaped inside the quotes (RFC 5322 quoted-string). */
export function fromHeader(name: string, address: string): string {
  return `"${name.replace(/[\\"]/g, (char) => `\\${char}`)}" <${address}>`;
}

/**
 * Sends through Resend's REST API with `fetch`, no SDK (outbox-dispatch door 7). `Idempotency-Key` makes Resend answer
 * a repeat of the same key within 24 hours with the first email's id instead of sending again. A recipient on a
 * reserved domain is refused before any request.
 */
export function resendEmailSender(options: { apiKey: string; from: string }): EmailSender {
  return {
    async send(message) {
      if (message.to.length === 0 || message.to.some(isReservedAddress)) return { ok: false, code: "reserved_domain" };
      let response: Response;
      try {
        response = await fetch(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({
            from: fromHeader(message.fromName, options.from),
            to: message.to,
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
          cache: "no-store",
        });
      } catch (cause) {
        console.error("Resend request failed", cause);
        return { ok: false, code: "unavailable" };
      }
      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
        if (typeof body?.id === "string") return { ok: true, providerMessageId: body.id };
        console.error("Resend answered without an email id");
        return { ok: false, code: "unavailable" };
      }
      console.error(`Resend answered ${response.status}: ${await response.text().catch(() => "")}`);
      // 429 rate limit, 409 a concurrent request with the same key, 5xx: worth retrying. Any other 4xx will not change.
      if (response.status === 429 || response.status === 409 || response.status >= 500) return { ok: false, code: "unavailable" };
      return { ok: false, code: "rejected" };
    },
  };
}
