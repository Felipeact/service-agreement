import type { BillingGateway, GatewayFailure, StripeIds } from "@/application/ports";
import type { BillingOverview, CardSummary, InvoiceSummary } from "@/domain/billing/overview";
import { INVOICE_LIMIT } from "@/domain/billing/overview";
import { STRIPE_TIMEOUT_MS, STRIPE_VERSION, encodeForm, errorCode } from "./http";

const API = "https://api.stripe.com/v1";

type Json = Record<string, unknown>;
type Answer = { ok: true; body: Json } | { ok: false };

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

function cardOf(paymentMethod: unknown): CardSummary | null {
  if (!isObject(paymentMethod) || !isObject(paymentMethod.card)) return null;
  const { brand, last4, exp_month: expMonth, exp_year: expYear } = paymentMethod.card;
  if (typeof brand !== "string" || typeof last4 !== "string" || typeof expMonth !== "number" || typeof expYear !== "number") return null;
  return { brand, last4, expMonth, expYear };
}

function invoiceOf(raw: unknown): InvoiceSummary | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id);
  const created = num(raw.created);
  const total = num(raw.total);
  const currency = text(raw.currency);
  const status = text(raw.status) ?? "unknown";
  if (!id || created === null || total === null || !currency) return null;
  return { id, number: text(raw.number), created, total, currency, status, hostedUrl: text(raw.hosted_invoice_url) };
}

/**
 * The in-app billing page's Stripe calls over `fetch`, no SDK (billing-page door 2). Reads happen on every request. A failure is
 * `unavailable` and logged once with the HTTP status and Stripe's error code only, never an id, the key or a body.
 */
export function stripeBillingGateway(options: { secretKey: string }): BillingGateway {
  /** One request. `what` names the call in the log; no id or body ever reaches it. */
  async function call(what: string, method: "GET" | "POST", path: string, form?: Parameters<typeof encodeForm>[0]): Promise<Answer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);
    try {
      const response = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${options.secretKey}`,
          "Stripe-Version": STRIPE_VERSION,
          ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        ...(form ? { body: encodeForm(form).join("&") } : {}),
        cache: "no-store",
        signal: controller.signal,
      });
      const json: unknown = await response.json().catch(() => null);
      if (response.status === 200 && isObject(json)) return { ok: true, body: json };
      const code = errorCode(json);
      console.error(`Stripe ${what} failed: HTTP ${response.status}${code ? `, ${code}` : ""}`);
      return { ok: false };
    } catch {
      console.error(`Stripe ${what} failed: no answer`);
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }

  const unavailable = { ok: false, code: "unavailable" } as const satisfies { ok: false; code: GatewayFailure };

  async function write(what: string, path: string, form: Parameters<typeof encodeForm>[0]) {
    const answer = await call(what, "POST", path, form);
    return answer.ok ? ({ ok: true } as const) : unavailable;
  }

  return {
    async overview({ customerId, subscriptionId }: StripeIds) {
      const [subscription, customer, invoices] = await Promise.all([
        call("subscription read", "GET", `/subscriptions/${encodeURIComponent(subscriptionId)}?expand%5B%5D=default_payment_method`),
        call("customer read", "GET", `/customers/${encodeURIComponent(customerId)}?expand%5B%5D=invoice_settings.default_payment_method`),
        call("invoice read", "GET", `/invoices?customer=${encodeURIComponent(customerId)}&limit=${INVOICE_LIMIT}`),
      ]);
      if (!subscription.ok) return unavailable;
      const sub = subscription.body;
      const status = sub.status;
      if (typeof status !== "string") {
        console.error("Stripe subscription read failed: unusable answer");
        return unavailable;
      }

      const items = isObject(sub.items) && Array.isArray(sub.items.data) ? sub.items.data : [];
      const firstItem = isObject(items[0]) ? items[0] : {};
      const periodEnd = num(firstItem.current_period_end);
      const cancelAt = num(sub.cancel_at);
      const endsAt = cancelAt ?? (sub.cancel_at_period_end === true ? periodEnd : null);

      const customerDefault = customer.ok && isObject(customer.body.invoice_settings) ? customer.body.invoice_settings.default_payment_method : null;
      const card = cardOf(sub.default_payment_method) ?? cardOf(customerDefault);

      const list = invoices.ok && Array.isArray(invoices.body.data) ? invoices.body.data : null;
      const overview: BillingOverview = {
        status,
        trialEnd: num(sub.trial_end),
        periodEnd,
        endsAt,
        card,
        invoices: list ? list.map(invoiceOf).filter((invoice): invoice is InvoiceSummary => invoice !== null) : "unavailable",
      };
      return { ok: true, overview } as const;
    },

    async startCardUpdate({ customerId }: StripeIds) {
      const answer = await call("card setup", "POST", "/setup_intents", { customer: customerId, usage: "off_session" });
      const secret = answer.ok ? text(answer.body.client_secret) : null;
      return secret ? ({ ok: true, clientSecret: secret } as const) : unavailable;
    },

    async finishCardUpdate({ customerId, subscriptionId }: StripeIds, setupIntentId: string) {
      const read = await call("card setup read", "GET", `/setup_intents/${encodeURIComponent(setupIntentId)}`);
      if (!read.ok) return unavailable;
      const paymentMethod = text(read.body.payment_method);
      // Door 3: only a SetupIntent that succeeded for this org's own customer may change a default.
      if (read.body.status !== "succeeded" || read.body.customer !== customerId || !paymentMethod) return { ok: false, code: "mismatch" } as const;
      const onCustomer = await write("card default", `/customers/${encodeURIComponent(customerId)}`, { invoice_settings: { default_payment_method: paymentMethod } });
      if (!onCustomer.ok) return onCustomer;
      return write("card default", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { default_payment_method: paymentMethod });
    },

    cancel({ subscriptionId }: StripeIds) {
      return write("cancel", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: "true" });
    },

    resume({ subscriptionId }: StripeIds) {
      return write("resume", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: "false" });
    },
  };
}
