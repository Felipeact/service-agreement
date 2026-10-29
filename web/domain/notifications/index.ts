import { contrastText, isAccent } from "../portal";

/** One email the system decided to send or skip (outbox-dispatch door 4). */
export type NotificationKind = "customer_link" | "customer_reminder" | "staff_decision" | "staff_stale";

/** Why a notification was not sent: the six stored skip reasons, and `failed` for a provider refusal or outage. */
export type NotEmailedReason = "decided" | "superseded" | "viewed" | "no_recipient" | "no_link_secret" | "reserved_domain" | "failed";

export type Tenant = { legalName: string; phone: string | null; accent: string | null };

/** The email a builder makes; the sender adds the tenant name, the recipients and the idempotency key. */
export type EmailContent = { subject: string; html: string; text: string };

/** Addresses no real mailbox has (RFC 2606): never handed to the provider (AC 22). */
export function isReservedAddress(address: string): boolean {
  const domain = address.trim().toLowerCase().split("@").pop() ?? "";
  return (
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net" ||
    domain.endsWith(".test") ||
    domain.endsWith(".invalid")
  );
}

const NOT_EMAILED: Record<NotEmailedReason, string> = {
  decided: "the customer already decided",
  superseded: "a newer version replaced this one",
  viewed: "the customer already opened the link",
  no_recipient: "the site has no contact email",
  no_link_secret: "the link cannot be sent again; get a new link",
  reserved_domain: "the contact email is a test address",
  failed: "the email service did not accept it",
};

/** The delivery line's words for a reason (AC 30). */
export function notEmailedWords(reason: NotEmailedReason): string {
  return NOT_EMAILED[reason];
}

export function isNotEmailedReason(value: string): value is NotEmailedReason {
  return value in NOT_EMAILED;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

/** `$3,870.00` from cents. */
export function formatCents(cents: number): string {
  return money.format(cents / 100);
}

/** `Oct 21, 2026`, in the business's time zone. */
export function formatDay(value: Date): string {
  return day.format(value);
}

const base = (url: string) => url.replace(/\/+$/, "");

function page(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px 16px;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111827;font-size:15px;line-height:1.5"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:24px">${body}</div></body></html>`;
}

function button(label: string, href: string, accent: string | null): string {
  const background = accent && isAccent(accent) ? accent : "#111827";
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:${background};color:${contrastText(background)};text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export type CustomerEmailInput = {
  tenant: Tenant;
  agreementNumber: string;
  siteName: string;
  annualCents: number;
  /** The live link's address, `<base>/review/<token>`. */
  reviewUrl: string;
  /** Set for the day-3 and day-7 reminders. */
  reminder: "day3" | "day7" | null;
};

/** The customer's email with the link, or a reminder of it: the tenant's voice, one button, no product name (AC 17, 18). */
export function customerEmail(input: CustomerEmailInput): EmailContent {
  const { tenant, agreementNumber, siteName, annualCents, reviewUrl, reminder } = input;
  const name = tenant.legalName;
  const subject = `${reminder ? "Reminder: service agreement" : "Service agreement"} ${agreementNumber} from ${name}`;
  const intro = reminder
    ? `${name} is waiting for your decision on service agreement ${agreementNumber}.`
    : `${name} sent you service agreement ${agreementNumber} to review.`;
  const total = `${formatCents(annualCents)} per year before tax`;
  const contact = tenant.phone ? `Questions? Call ${name} at ${tenant.phone}.` : `Questions? Reply to this email.`;

  const html = page(
    [
      `<p style="margin:0 0 12px">${escapeHtml(intro)}</p>`,
      `<p style="margin:0">Site: <strong>${escapeHtml(siteName)}</strong><br>Total: <strong>${escapeHtml(total)}</strong></p>`,
      button("Review the agreement", reviewUrl, tenant.accent),
      `<p style="margin:0 0 12px">You can accept it, ask for changes or refuse it from that page.</p>`,
      `<p style="margin:0;color:#4b5563">${escapeHtml(contact)}</p>`,
    ].join(""),
  );
  const text = [
    intro,
    "",
    `Site: ${siteName}`,
    `Total: ${total}`,
    "",
    `Review the agreement: ${reviewUrl}`,
    "You can accept it, ask for changes or refuse it from that page.",
    "",
    contact,
  ].join("\n");
  return { subject, html, text };
}

export type StaffDecisionInput = {
  appBaseUrl: string;
  agreement: { id: string; number: string };
  customerName: string;
  decision: "refused" | "changes_requested";
  reason: string | null;
};

/** The estimator's email when the customer refuses or asks for changes (AC 25). */
export function staffDecisionEmail(input: StaffDecisionInput): EmailContent {
  const { agreement, customerName, decision, reason } = input;
  const subject =
    decision === "refused" ? `${customerName} refused ${agreement.number}` : `${customerName} asked for changes to ${agreement.number}`;
  const href = `${base(input.appBaseUrl)}/agreements/${agreement.id}`;
  const said = reason && reason.trim() ? reason.trim() : "No reason given.";
  const html = page(
    [
      `<p style="margin:0 0 12px">${escapeHtml(subject)}.</p>`,
      `<p style="margin:0 0 4px;color:#4b5563">Their words:</p>`,
      `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #e5e7eb">${escapeHtml(said)}</blockquote>`,
      `<p style="margin:16px 0 0"><a href="${escapeHtml(href)}">Open ${escapeHtml(agreement.number)}</a></p>`,
    ].join(""),
  );
  const text = [`${subject}.`, "", "Their words:", said, "", `Open ${agreement.number}: ${href}`].join("\n");
  return { subject, html, text };
}

export type StaleAgreement = { id: string; number: string; customerName: string; sentAt: Date };

/** The daily list of sent agreements nobody opened in 7 days, for owners and admins (AC 27). */
export function staleEmail(input: { appBaseUrl: string; agreements: StaleAgreement[] }): EmailContent {
  const count = input.agreements.length;
  const subject = `${count} ${count === 1 ? "agreement" : "agreements"} not viewed after 7 days`;
  const rows = input.agreements.map((item) => ({ ...item, href: `${base(input.appBaseUrl)}/agreements/${item.id}`, sent: formatDay(item.sentAt) }));
  const html = page(
    [
      `<p style="margin:0 0 12px">These agreements were sent and the customer has not opened the link after 7 days.</p>`,
      `<ul style="margin:0;padding-left:20px">`,
      ...rows.map(
        (row) =>
          `<li style="margin:0 0 8px"><a href="${escapeHtml(row.href)}">${escapeHtml(row.number)}</a> · ${escapeHtml(row.customerName)} · sent ${escapeHtml(row.sent)}</li>`,
      ),
      `</ul>`,
    ].join(""),
  );
  const text = [
    "These agreements were sent and the customer has not opened the link after 7 days.",
    "",
    ...rows.map((row) => `${row.number} · ${row.customerName} · sent ${row.sent}: ${row.href}`),
  ].join("\n");
  return { subject, html, text };
}
