import type { BillingGateway, GatewayFailure, StripeIds } from "@/application/ports";
import { EXTRA_SEAT_CENTS, PLANS, PLAN_KEYS, type PlanKey } from "@/domain/billing";
import type { BillingOverview, CardSummary, InvoiceSummary } from "@/domain/billing/overview";
import { INVOICE_LIMIT } from "@/domain/billing/overview";
import { STRIPE_TIMEOUT_MS, STRIPE_VERSION, encodeForm, errorCode } from "./http";

const API = "https://api.stripe.com/v1";

type Json = Record<string, unknown>;
type Answer = { ok: true; body: Json } | { ok: false; status: number | null };

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

function cardOf(paymentMethod: unknown): CardSummary | null {
  if (!isObject(paymentMethod) || !isObject(paymentMethod.card)) return null;
  const { brand, last4, exp_month: expMonth, exp_year: expYear } = paymentMethod.card;
  if (typeof brand !== "string" || typeof last4 !== "string" || typeof expMonth !== "number" || typeof expYear !== "number") return null;
  return { brand, last4, expMonth, expYear };
}

type Tagged = { id: string; kind: "plan" | "seat"; plan: PlanKey | null; quantity: number };

/**
 * The subscription items whose product is tagged `sa_kind` plan or seat (plan-change door 1), with the plan key the plan item's
 * product carries. Items without an expanded, tagged product are left out, so an item is never guessed.
 */
function taggedItems(subscription: Json): Tagged[] {
  const items = isObject(subscription.items) && Array.isArray(subscription.items.data) ? subscription.items.data : [];
  return items.flatMap((raw): Tagged[] => {
    if (!isObject(raw)) return [];
    const id = text(raw.id);
    const product = isObject(raw.price) ? raw.price.product : null;
    if (!id || !isObject(product) || !isObject(product.metadata)) return [];
    const kind = product.metadata.sa_kind;
    if (kind !== "plan" && kind !== "seat") return [];
    const planValue = product.metadata.sa_plan;
    const plan = kind === "plan" ? (PLAN_KEYS.find((key) => key === planValue) ?? null) : null;
    return [{ id, kind, plan, quantity: num(raw.quantity) ?? 0 }];
  });
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
  async function call(what: string, method: "GET" | "POST", path: string, form?: Parameters<typeof encodeForm>[0], tolerate404 = false): Promise<Answer> {
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
      if (tolerate404 && response.status === 404) return { ok: false, status: 404 };
      const code = errorCode(json);
      console.error(`Stripe ${what} failed: HTTP ${response.status}${code ? `, ${code}` : ""}`);
      return { ok: false, status: response.status };
    } catch {
      console.error(`Stripe ${what} failed: no answer`);
      return { ok: false, status: null };
    } finally {
      clearTimeout(timer);
    }
  }

  const unavailable = { ok: false, code: "unavailable" } as const satisfies { ok: false; code: GatewayFailure };

  async function write(what: string, path: string, form: Parameters<typeof encodeForm>[0]) {
    const answer = await call(what, "POST", path, form);
    return answer.ok ? ({ ok: true } as const) : unavailable;
  }

  /** Makes sure a product with this id exists, creating it on the first use; a 404 on the read is the signal (plan-change door 1). */
  async function ensureProduct(id: string, name: string, metadata: Record<string, string>): Promise<boolean> {
    const read = await call("product read", "GET", `/products/${encodeURIComponent(id)}`, undefined, true);
    if (read.ok) return true;
    if (read.status !== 404) return false;
    const created = await call("product create", "POST", "/products", { id, name, metadata });
    return created.ok;
  }

  return {
    async overview({ customerId, subscriptionId }: StripeIds) {
      const [subscription, customer, invoices] = await Promise.all([
        call("subscription read", "GET", `/subscriptions/${encodeURIComponent(subscriptionId)}?expand%5B%5D=default_payment_method&expand%5B%5D=items.data.price.product`),
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

      const subscriptionCard = cardOf(sub.default_payment_method);
      // Without the customer record the card may be misreported, so a failed customer read is only tolerated when the subscription has its own card.
      if (!customer.ok && !subscriptionCard) return unavailable;
      const tagged = taggedItems(sub);
      const customerDefault = customer.ok && isObject(customer.body.invoice_settings) ? customer.body.invoice_settings.default_payment_method : null;
      const card = subscriptionCard ?? cardOf(customerDefault);

      const list = invoices.ok && Array.isArray(invoices.body.data) ? invoices.body.data : null;
      const overview: BillingOverview = {
        status,
        trialEnd: num(sub.trial_end),
        periodEnd,
        endsAt,
        plan: tagged.find((item) => item.kind === "plan")?.plan ?? null,
        extraSeats: tagged.find((item) => item.kind === "seat")?.quantity ?? 0,
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

    async changePlan({ subscriptionId }: StripeIds, change: { plan: PlanKey; extraSeats: number }) {
      const read = await call("subscription read", "GET", `/subscriptions/${encodeURIComponent(subscriptionId)}?expand%5B%5D=items.data.price.product`);
      if (!read.ok) return unavailable;
      const items = taggedItems(read.body);
      const planItem = items.find((item) => item.kind === "plan");
      const seatItem = items.find((item) => item.kind === "seat");
      if (!planItem) {
        console.error("Stripe plan change refused: no plan item");
        return { ok: false, code: "unsupported" } as const;
      }
      const planChanges = planItem.plan !== change.plan;
      const seatQuantity = seatItem?.quantity ?? 0;
      if (!planChanges && seatQuantity === change.extraSeats) return { ok: true, changed: false } as const;

      const definition = PLANS.find((candidate) => candidate.key === change.plan)!;
      const entries: Parameters<typeof encodeForm>[0][] = [];
      if (planChanges) {
        if (!(await ensureProduct(`sa_plan_${change.plan}`, `${definition.name} plan`, { sa_kind: "plan", sa_plan: change.plan }))) return unavailable;
        entries.push({
          id: planItem.id,
          price_data: { currency: "cad", unit_amount: definition.monthlyCents, recurring: { interval: "month" }, product: `sa_plan_${change.plan}` },
        });
      }
      if (seatItem) {
        if (seatQuantity !== change.extraSeats) entries.push(change.extraSeats > 0 ? { id: seatItem.id, quantity: change.extraSeats } : { id: seatItem.id, deleted: "true" });
      } else if (change.extraSeats > 0) {
        if (!(await ensureProduct("sa_extra_seat", "Extra seat", { sa_kind: "seat" }))) return unavailable;
        entries.push({
          price_data: { currency: "cad", unit_amount: EXTRA_SEAT_CENTS, recurring: { interval: "month" }, product: "sa_extra_seat" },
          quantity: change.extraSeats,
        });
      }
      const updated = await write("plan change", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { items: entries, proration_behavior: "create_prorations" });
      return updated.ok ? ({ ok: true, changed: true } as const) : updated;
    },

    cancel({ subscriptionId }: StripeIds) {
      return write("cancel", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: "true" });
    },

    resume({ subscriptionId }: StripeIds) {
      return write("resume", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: "false" });
    },
  };
}
