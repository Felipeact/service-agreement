import type { BillingPortal } from "@/application/ports";
import { STRIPE_TIMEOUT_MS, STRIPE_VERSION, encodeForm, errorCode } from "./http";

const SESSIONS_URL = "https://api.stripe.com/v1/billing_portal/sessions";

/**
 * Opens a Stripe billing portal session with `fetch`, no SDK (billing-portal door 2). The return address is
 * `<appBaseUrl>/settings`. A failure is `unavailable` and is logged once with the HTTP status and Stripe's error code only,
 * never the customer id, the key or the body.
 */
export function stripeBillingPortal(options: { secretKey: string; appBaseUrl: string }): BillingPortal {
  const base = options.appBaseUrl.replace(/\/+$/, "");
  return {
    async open({ customerId }) {
      const body = encodeForm({ customer: customerId, return_url: `${base}/settings` }).join("&");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);
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
        console.error(`Stripe billing portal failed: HTTP ${response.status}${code ? `, ${code}` : ""}`);
        return { ok: false, code: "unavailable" };
      } catch {
        console.error("Stripe billing portal failed: no answer");
        return { ok: false, code: "unavailable" };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
