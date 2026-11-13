import { formatTermDate } from "@/domain/agreement/term";
import type { PlanKey } from "./index";

/** The roles that may see and change billing: the ones `org_billing_select` admits (billing-page Assumptions). */
export function canManageBilling(role: string): boolean {
  return role === "owner" || role === "admin";
}

export type CardSummary = { brand: string; last4: string; expMonth: number; expYear: number };

/** One invoice as Stripe reports it; `created` is unix seconds and `total` is in the currency's minor unit. */
export type InvoiceSummary = {
  id: string;
  number: string | null;
  created: number;
  total: number;
  currency: string;
  status: string;
  hostedUrl: string | null;
};

/** What the billing page shows about one subscription, read live from Stripe and never stored (billing-page Impact). */
export type BillingOverview = {
  status: string;
  /** Unix seconds, or `null` when there is no trial. */
  trialEnd: number | null;
  /** The subscription item's period end (the pinned API version has no subscription-level one). */
  periodEnd: number | null;
  /** When service ends, if the subscription is set to end. */
  endsAt: number | null;
  /** The plan on the subscription's plan item (its product's `sa_plan`), or `null` when no item is tagged as the plan item (plan-change AC 2, 5). */
  plan: PlanKey | null;
  /** The quantity of the seat item, 0 when there is none. */
  extraSeats: number;
  card: CardSummary | null;
  invoices: InvoiceSummary[] | "unavailable";
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Payment overdue",
  unpaid: "Unpaid",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  paused: "Paused",
};

export function statusLabel(status: string): string {
  return Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status] : "Unknown";
}

const businessDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" });

/** The business's calendar day (`YYYY-MM-DD`) of a unix time. */
export function dayOf(unixSeconds: number): string {
  return businessDay.format(unixSeconds * 1000);
}

/** A unix time as the page shows a date ("Dec 10, 2026"), in the business time zone. */
export const formatDay = (unixSeconds: number) => formatTermDate(dayOf(unixSeconds));

/** "Trial ends ...", "Renews ..." or "Ends ..."; `null` when the status has no date worth showing. */
export function dateLine(overview: BillingOverview): string | null {
  if (overview.status === "canceled") return null;
  if (overview.endsAt !== null) return `Ends ${formatDay(overview.endsAt)}`;
  if (overview.status === "trialing" && overview.trialEnd !== null) return `Trial ends ${formatDay(overview.trialEnd)}`;
  if (overview.status === "active" && overview.periodEnd !== null) return `Renews ${formatDay(overview.periodEnd)}`;
  return null;
}

export function cardLine(card: CardSummary | null): string {
  if (!card) return "No payment method";
  const brand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
  return `${brand} ending ${card.last4}, expires ${String(card.expMonth).padStart(2, "0")}/${card.expYear}`;
}

export type InvoiceRow = { id: string; number: string; day: string; amount: string; status: string; url: string | null };

/** The newest invoices shown, at most this many. */
export const INVOICE_LIMIT = 12;

const isHttps = (url: string | null): url is string => {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

export function formatInvoiceAmount(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: currency.toUpperCase() }).format(minorUnits / 100);
}

/** Newest first, at most 12; a View link only for an https address. */
export function invoiceRows(invoices: InvoiceSummary[]): InvoiceRow[] {
  return [...invoices]
    .sort((a, b) => b.created - a.created)
    .slice(0, INVOICE_LIMIT)
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number ?? "—",
      day: formatDay(invoice.created),
      amount: formatInvoiceAmount(invoice.total, invoice.currency),
      status: invoice.status,
      url: isHttps(invoice.hostedUrl) ? invoice.hostedUrl : null,
    }));
}

/** The statuses that freeze the workspace until the company renews (the same set as `public.my_org_frozen`). */
export const ENDED_STATUSES = ["canceled", "unpaid", "incomplete_expired"] as const;

export function isEnded(status: string): boolean {
  return (ENDED_STATUSES as readonly string[]).includes(status);
}

/** Update card, Cancel and Resume are offered for every status except an ended subscription. */
export function canChangeBilling(status: string): boolean {
  return !isEnded(status);
}
