import type { CheckoutStarter } from "@/application/ports";
import { PLANS, knownTrades } from "@/domain/billing";

const SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";

/** The API version this code was written against (billing-checkout door 1); a response shape is never read from the account default. */
export const STRIPE_VERSION = "2026-10-28.endive";

const TIMEOUT_MS = 10_000;
const TRIAL_DAYS = 14;

type FormValue = string | number | FormValue[] | { [key: string]: FormValue };

/** Stripe's form encoding: nested keys as `a[b][c]`, arrays as `a[0]`. */
function encodeForm(value: FormValue, prefix = ""): string[] {
  if (typeof value === "object") {
    const entries = Array.isArray(value) ? value.map((item, index): [string, FormValue] => [String(index), item]) : Object.entries(value);
    return entries.flatMap(([key, item]) => encodeForm(item, prefix ? `${prefix}[${key}]` : key));
  }
  return [`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`];
}

/** Stripe's `error.code`, only when it looks like a code, so a message or a value Stripe echoes never reaches the log. */
function errorCode(body: unknown): string | undefined {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === "string" && /^[a-z_]{1,64}$/.test(code) ? code : undefined;
}

/**
 * Opens a Stripe Checkout session for a 14-day, card-required trial with `fetch`, no SDK (billing-checkout door 1). The plan's
 * price is sent inline from `PLANS` (door 2), so the catalog stays the one source. A failure is `unavailable` and is logged once
 * with the HTTP status and Stripe's error code only.
 */
export function stripeCheckoutStarter(options: { secretKey: string; appBaseUrl: string }): CheckoutStarter {
  const base = options.appBaseUrl.replace(/\/+$/, "");
  return {
    async start({ plan, trades }) {
      const chosen = PLANS.find((candidate) => candidate.key === plan);
      if (!chosen) return { ok: false, code: "unavailable" };
      const metadata = { plan, trades: knownTrades(trades).join(",") };
      const body = encodeForm({
        mode: "subscription",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              unit_amount: chosen.monthlyCents,
              recurring: { interval: "month" },
              product_data: { name: `${chosen.name} plan` },
            },
          },
        ],
        payment_method_collection: "always",
        subscription_data: {
          trial_period_days: TRIAL_DAYS,
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          metadata,
        },
        metadata,
        success_url: `${base}/register/success`,
        cancel_url: `${base}/register?plan=${plan}`,
      }).join("&");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(SESSIONS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Stripe-Version": STRIPE_VERSION,
          },
          body,
          cache: "no-store",
          signal: controller.signal,
        });
        const json: unknown = await response.json().catch(() => null);
        const url = (json as { url?: unknown } | null)?.url;
        if (response.status === 200 && typeof url === "string" && url !== "") return { ok: true, url };
        const code = errorCode(json);
        console.error(`Stripe checkout failed: HTTP ${response.status}${code ? `, ${code}` : ""}`);
        return { ok: false, code: "unavailable" };
      } catch {
        console.error("Stripe checkout failed: no answer");
        return { ok: false, code: "unavailable" };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
