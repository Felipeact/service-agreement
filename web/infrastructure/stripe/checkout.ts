import type { CheckoutStarter } from "@/application/ports";
import { EXTRA_SEAT_CENTS, PLANS, knownTrades } from "@/domain/billing";
import { STRIPE_TIMEOUT_MS, STRIPE_VERSION, encodeForm, errorCode } from "./http";

const SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";

export { STRIPE_VERSION };

const TIMEOUT_MS = STRIPE_TIMEOUT_MS;

/**
 * Opens a Stripe Checkout session for a card-required subscription that bills at once (no trial) with `fetch`, no SDK (billing-checkout door 1). The plan's
 * price is sent inline from `PLANS` (door 2), so the catalog stays the one source. A failure is `unavailable` and is logged once
 * with the HTTP status and Stripe's error code only.
 */
export function stripeCheckoutStarter(options: { secretKey: string; appBaseUrl: string }): CheckoutStarter {
  const base = options.appBaseUrl.replace(/\/+$/, "");
  return {
    async start({ plan, trades, seats, email, company, phone }) {
      const chosen = PLANS.find((candidate) => candidate.key === plan);
      if (!chosen) return { ok: false, code: "unavailable" };
      const metadata = { plan, trades: knownTrades(trades).join(","), seats, company, phone };
      const extraSeats = seats - chosen.includedSeats;
      const body = encodeForm({
        mode: "subscription",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              unit_amount: chosen.monthlyCents,
              recurring: { interval: "month" },
              product_data: { name: `${chosen.name} plan`, metadata: { sa_kind: "plan", sa_plan: chosen.key } },
            },
          },
          ...(extraSeats > 0
            ? [
                {
                  quantity: extraSeats,
                  price_data: { currency: "cad", unit_amount: EXTRA_SEAT_CENTS, recurring: { interval: "month" }, product_data: { name: "Extra seat", metadata: { sa_kind: "seat" } } },
                },
              ]
            : []),
        ],
        customer_email: email,
        payment_method_collection: "always",
        subscription_data: {
          metadata,
        },
        metadata,
        // Stripe fills the braces in with the session id when it redirects (workspace-pending-state door 1).
        success_url: `${base}/register/success?session_id={CHECKOUT_SESSION_ID}`,
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
